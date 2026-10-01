import { describe, it, expect } from 'vitest'
import { migrationEnAttente } from './migrationEnAttente'

// ─────────────────────────────────────────────────────────────────────────────
// Ce détecteur décide si un laveur lit « une erreur interne est survenue » ou
// « ce n'est pas encore activé ». Se tromper dans un sens envoie quelqu'un au
// support pour rien ; se tromper dans l'autre fait passer une VRAIE panne pour
// une mise en service en attente, et plus personne ne la regarde.
// ─────────────────────────────────────────────────────────────────────────────

describe('migrationEnAttente', () => {
  it('reconnaît une table absente, à la lecture', () => {
    // Exactement ce que renvoie PostgREST aujourd'hui sur `campagnes`.
    expect(migrationEnAttente({
      code: 'PGRST205',
      message: "Could not find the table 'public.campagnes' in the schema cache",
    })).toBe(true)
  })

  it('reconnaît une colonne absente, à l’écriture', () => {
    expect(migrationEnAttente({
      code: 'PGRST204',
      message: "Could not find the 'utm_content' column of 'bookings' in the schema cache",
    })).toBe(true)
  })

  it('reconnaît les codes de PostgreSQL lui-même', () => {
    expect(migrationEnAttente({ code: '42P01', message: 'relation "campagnes" does not exist' })).toBe(true)
    expect(migrationEnAttente({ code: '42703', message: 'column bookings.utm_campaign does not exist' })).toBe(true)
  })

  it('se rabat sur le message quand le code manque', () => {
    // Une erreur ne remonte pas toujours avec un code exploitable.
    expect(migrationEnAttente({ message: 'column bookings.utm_content does not exist' })).toBe(true)
    expect(migrationEnAttente({ message: 'relation "campagne_creations" does not exist' })).toBe(true)
  })

  it('laisse une panne rester une panne', () => {
    // Le cas qui compte : ces erreurs-là doivent rester bruyantes, avec un
    // errorId à chercher dans les journaux.
    expect(migrationEnAttente({ code: '23505', message: 'duplicate key value' })).toBe(false)
    expect(migrationEnAttente({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe(false)
    expect(migrationEnAttente(new Error('fetch failed'))).toBe(false)
  })

  it('ne confond JAMAIS un refus de droits avec une mise en service', () => {
    // Une requête refusée par la RLS ou un GRANT oublié ressemble de loin à une
    // table absente. C'est une vraie anomalie : la masquer derrière « pas encore
    // activé » ferait passer une fuite de droits pour une attente.
    expect(migrationEnAttente({
      code: '42501',
      message: 'permission denied for table campagnes',
    })).toBe(false)
    expect(migrationEnAttente({
      code: 'PGRST301',
      message: 'JWT expired',
    })).toBe(false)
  })

  it('ne casse sur rien', () => {
    expect(migrationEnAttente(null)).toBe(false)
    expect(migrationEnAttente(undefined)).toBe(false)
    expect(migrationEnAttente('PGRST205')).toBe(false)
    expect(migrationEnAttente({})).toBe(false)
    expect(migrationEnAttente({ code: 42703 })).toBe(false)
  })
})
