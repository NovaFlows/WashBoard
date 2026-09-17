import { describe, it, expect, vi, beforeEach } from 'vitest'

// `resend` fait un vrai appel réseau : on capture juste l'objet passé à
// `.send()`, jamais de dépôt en base ni d'envoi réel (voir consigne du dépôt).
const sendMock = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null })
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

const envoi = () => sendMock.mock.calls.at(-1)![0]

describe('sendSupportReply', () => {
  beforeEach(() => {
    sendMock.mockClear()
  })

  it('pointe vers le lien de fil attendu par l’interface, ?fil=<id>', async () => {
    const { sendSupportReply } = await import('./index')
    await sendSupportReply({ to: 'laveur@test.fr', titreQuestion: 'Souci de facturation', questionId: 'q1' })
    expect(envoi().html).toContain('/dashboard/assistance?fil=q1')
  })

  it('échappe le titre saisi par le laveur', async () => {
    const { sendSupportReply } = await import('./index')
    await sendSupportReply({ to: 'laveur@test.fr', titreQuestion: '<script>alert(1)</script>', questionId: 'q2' })
    expect(envoi().html).not.toContain('<script>alert(1)</script>')
    expect(envoi().html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  // ── Garde-fou : l'email ne transporte jamais le texte de la réponse ──
  //
  // Relevé par `cyber` le 2026-09-17 : l'ancien test vérifiait qu'une phrase
  // précise n'apparaissait pas dans l'email, alors que la fonction n'avait de
  // toute façon aucun moyen de la recevoir. Il ne pouvait donc jamais échouer,
  // même si quelqu'un ajoutait un extrait de la réponse. Les trois verrous
  // ci-dessous échouent, eux, dès que la forme de l'email change.

  it('verrou 1 — la fonction refuse tout paramètre portant la réponse', async () => {
    const { sendSupportReply } = await import('./index')
    await sendSupportReply({
      to: 'laveur@test.fr',
      titreQuestion: 'Titre',
      questionId: 'q3',
      // @ts-expect-error — si ce paramètre devient accepté, cette directive
      // devient inutile et la vérification de types (CI) échoue : ajouter la
      // réponse à l'email doit être une décision consciente, pas un glissement.
      reponse: 'Votre mot de passe temporaire est XJ4-92Kd.',
    })
    expect(envoi().html).not.toContain('XJ4-92Kd')
  })

  it('verrou 2 — champs envoyés et objet figés, le titre n’entre jamais dans un en-tête', async () => {
    const { sendSupportReply } = await import('./index')
    await sendSupportReply({ to: 'laveur@test.fr', titreQuestion: 'Souci\rBcc: pirate@exemple.test', questionId: 'q4' })
    // Aucun champ texte brut, aucun en-tête supplémentaire.
    expect(Object.keys(envoi()).sort()).toEqual(['from', 'html', 'subject', 'to'])
    // Objet fixe : ne dépend d'aucune saisie du laveur.
    expect(envoi().subject).toBe("Réponse de l'équipe WashBoard")
    expect(envoi().to).toBe('laveur@test.fr')
  })

  it('verrou 3 — le contenu ne dépend que du titre et du lien, et il est figé', async () => {
    const { sendSupportReply } = await import('./index')
    const gabarit = async (titre: string, id: string) => {
      await sendSupportReply({ to: 'laveur@test.fr', titreQuestion: titre, questionId: id, appUrl: 'https://app.test' })
      return (envoi().html as string).replaceAll(titre, '{TITRE}').replaceAll(id, '{ID}')
    }
    const a = await gabarit('Premier titre', 'aaaa1111')
    const b = await gabarit('Un tout autre sujet', 'bbbb2222')
    // Deux emails différents ne diffèrent QUE par le titre et le lien.
    expect(a).toBe(b)
    // Et ce gabarit est figé : toute ligne ajoutée — un extrait de réponse par
    // exemple — casse ce test et oblige à mettre l'instantané à jour sciemment.
    expect(a).toMatchSnapshot()
  })
})
