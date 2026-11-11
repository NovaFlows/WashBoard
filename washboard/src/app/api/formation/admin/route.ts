import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isTrustedOrigin } from '@/lib/appOrigin'
import { rateLimit } from '@/lib/rateLimit'
import { formationAdmin } from '@/lib/formationAcces'
import { BUCKET_VIDEOS, TAILLE_MAX_VIDEO_MO, TYPES_VIDEO_ACCEPTES, cheminVideo, nettoyerLecon, nettoyerPack, slugDe } from '@/lib/formationAdmin'
import { logger } from '@/lib/logger'

// Gestion de la formation par les administrateurs (branche feat/formation, 2026-11-11) : créer,
// modifier, supprimer des packs et des leçons, préparer l'envoi d'une vidéo. Une seule route, un
// champ `action` ; chaque action est validée par `formationAdmin.ts` avant d'atteindre la base.
//
// 404 pour quiconque n'est pas administrateur : la route n'existe pas pour lui. Les écritures
// passent par la clé service_role (les tables n'ont aucune politique RLS : seul ce serveur y écrit).
// La vidéo ne transite PAS par cette route (trop lourde pour une fonction serverless) : on renvoie
// une URL d'envoi signée, le navigateur envoie le fichier directement dans le bucket privé.

type Corps = { action?: string; [cle: string]: unknown }

const introuvable = () => NextResponse.json({ error: 'Introuvable' }, { status: 404 })
const invalide = (message = 'Requête invalide.') => NextResponse.json({ error: message }, { status: 400 })
const id = (v: unknown): string | null => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null)

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req.headers.get('origin')) || !req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Requête refusée' }, { status: 403 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!formationAdmin(user.id)) return introuvable()

  const limite = rateLimit(`formation-admin:${user.id}`, 300, 60 * 60 * 1000)
  if (!limite.ok) return NextResponse.json({ error: 'Trop de demandes.', retryAfter: limite.retryAfter }, { status: 429 })

  const corps = await req.json().catch(() => null) as Corps | null
  if (!corps || typeof corps.action !== 'string') return invalide()

  const db = createAdminClient()
  const echec = (code: string, erreur: unknown) => {
    logger.error(`formation.admin.${code}`, { userId: user.id }, erreur instanceof Error ? erreur : undefined)
    return NextResponse.json({ error: 'Enregistrement impossible. Les tables de la formation existent-elles ?' }, { status: 500 })
  }

  switch (corps.action) {
    case 'pack.creer': {
      const champs = nettoyerPack(corps.champs)
      if (!champs?.titre) return invalide('Un titre est nécessaire.')
      // Slug unique : on ajoute un suffixe tant qu'il existe déjà.
      const base = slugDe(champs.titre)
      let slug = base
      for (let i = 2; i < 50; i++) {
        const { data } = await db.from('formation_packs').select('id').eq('slug', slug).maybeSingle()
        if (!data) break
        slug = `${base}-${i}`
      }
      const { data, error } = await db.from('formation_packs').insert({ ...champs, slug, publie: false }).select('id, slug').single()
      if (error) return echec('pack_creer', error)
      return NextResponse.json({ ok: true, id: data.id, slug: data.slug })
    }

    case 'pack.maj': {
      const packId = id(corps.id)
      const champs = nettoyerPack(corps.champs)
      if (!packId || !champs) return invalide()
      const { error } = await db.from('formation_packs').update({ ...champs, updated_at: new Date().toISOString() }).eq('id', packId)
      if (error) return echec('pack_maj', error)
      return NextResponse.json({ ok: true })
    }

    case 'pack.supprimer': {
      const packId = id(corps.id)
      if (!packId) return invalide()
      // Les vidéos des leçons du pack partent avec lui : sinon le bucket garderait des fichiers orphelins.
      const { data: lecons } = await db.from('formation_lecons').select('video_path').eq('pack_id', packId)
      const chemins = (lecons ?? []).map(l => l.video_path).filter((c): c is string => !!c)
      if (chemins.length) await db.storage.from(BUCKET_VIDEOS).remove(chemins)
      const { error } = await db.from('formation_packs').delete().eq('id', packId)
      if (error) return echec('pack_supprimer', error)
      return NextResponse.json({ ok: true })
    }

    case 'lecon.ajouter': {
      const packId = id(corps.packId)
      const champs = nettoyerLecon(corps.champs)
      if (!packId || !champs?.titre) return invalide('Un titre est nécessaire.')
      const { data: derniere } = await db.from('formation_lecons').select('ordre').eq('pack_id', packId).order('ordre', { ascending: false }).limit(1).maybeSingle()
      const { data, error } = await db.from('formation_lecons')
        .insert({ ...champs, pack_id: packId, ordre: champs.ordre ?? (derniere?.ordre ?? 0) + 1 })
        .select('id').single()
      if (error) return echec('lecon_ajouter', error)
      return NextResponse.json({ ok: true, id: data.id })
    }

    case 'lecon.maj': {
      const leconId = id(corps.id)
      const champs = nettoyerLecon(corps.champs)
      if (!leconId || !champs) return invalide()
      const { error } = await db.from('formation_lecons').update(champs).eq('id', leconId)
      if (error) return echec('lecon_maj', error)
      return NextResponse.json({ ok: true })
    }

    case 'lecon.supprimer': {
      const leconId = id(corps.id)
      if (!leconId) return invalide()
      const { data } = await db.from('formation_lecons').select('video_path').eq('id', leconId).maybeSingle()
      if (data?.video_path) await db.storage.from(BUCKET_VIDEOS).remove([data.video_path])
      const { error } = await db.from('formation_lecons').delete().eq('id', leconId)
      if (error) return echec('lecon_supprimer', error)
      return NextResponse.json({ ok: true })
    }

    // Étape 1 de l'envoi d'une vidéo : une URL d'envoi signée, valable quelques minutes.
    case 'video.preparer': {
      const leconId = id(corps.leconId)
      const nom = typeof corps.nom === 'string' ? corps.nom : ''
      const type = typeof corps.type === 'string' ? corps.type : ''
      const tailleMo = typeof corps.tailleMo === 'number' ? corps.tailleMo : 0
      if (!leconId || !nom) return invalide()
      if (!TYPES_VIDEO_ACCEPTES.includes(type)) return invalide('Format refusé : MP4, WebM ou MOV.')
      if (tailleMo > TAILLE_MAX_VIDEO_MO) return invalide(`Vidéo trop lourde (${TAILLE_MAX_VIDEO_MO} Mo maximum).`)
      const chemin = cheminVideo(leconId, nom)
      const { data, error } = await db.storage.from(BUCKET_VIDEOS).createSignedUploadUrl(chemin)
      if (error || !data) return echec('video_preparer', error)
      return NextResponse.json({ ok: true, chemin, jeton: data.token })
    }

    // Étape 2 : le fichier est dans le bucket, on le rattache à la leçon (et on supprime l'ancien).
    case 'video.rattacher': {
      const leconId = id(corps.leconId)
      const chemin = typeof corps.chemin === 'string' ? corps.chemin : ''
      // Le chemin doit être rangé sous la leçon : on ne rattache pas le fichier d'une autre.
      if (!leconId || !chemin.startsWith(`${leconId}/`)) return invalide()
      const dureeSec = typeof corps.dureeSec === 'number' && Number.isFinite(corps.dureeSec) ? Math.max(0, Math.round(corps.dureeSec)) : null
      const { data: avant } = await db.from('formation_lecons').select('video_path').eq('id', leconId).maybeSingle()
      const { error } = await db.from('formation_lecons')
        .update({ video_path: chemin, type: 'video', ...(dureeSec ? { duree_sec: dureeSec } : {}) })
        .eq('id', leconId)
      if (error) return echec('video_rattacher', error)
      if (avant?.video_path && avant.video_path !== chemin) await db.storage.from(BUCKET_VIDEOS).remove([avant.video_path])
      return NextResponse.json({ ok: true })
    }

    case 'video.retirer': {
      const leconId = id(corps.leconId)
      if (!leconId) return invalide()
      const { data } = await db.from('formation_lecons').select('video_path').eq('id', leconId).maybeSingle()
      if (data?.video_path) await db.storage.from(BUCKET_VIDEOS).remove([data.video_path])
      const { error } = await db.from('formation_lecons').update({ video_path: null }).eq('id', leconId)
      if (error) return echec('video_retirer', error)
      return NextResponse.json({ ok: true })
    }

    default:
      return invalide()
  }
}
