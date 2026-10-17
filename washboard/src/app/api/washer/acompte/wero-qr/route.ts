import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Photo du QR code Wero personnel du laveur (lib/acompte.ts), prise dans son application
// bancaire. Rangée avec les logos (bucket public) sous `wero/<user_id>.<ext>`, un seul fichier
// par laveur (remplacé à chaque envoi). L'adresse renvoyée est enregistrée avec les réglages
// d'acompte ; elle n'est montrée au client qu'après sa réservation.
//
// Même garde-fou de taille que le logo : l'écran compresse l'image avant l'envoi.
const TAILLE_MAX = 500 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/webp']

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Image manquante' }, { status: 400 })
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: 'Choisissez une image (PNG, JPG ou WebP).' }, { status: 400 })
  if (file.size > TAILLE_MAX) {
    return NextResponse.json({ error: 'Image trop lourde. Essayez avec une capture plus petite.' }, { status: 413 })
  }

  const extension = file.type === 'image/webp' ? 'webp' : file.type === 'image/jpeg' ? 'jpg' : 'png'
  const chemin = `wero/${user.id}.${extension}`
  const admin = createAdminClient()
  const { error } = await admin.storage
    .from('logos')
    .upload(chemin, await file.arrayBuffer(), { contentType: file.type, upsert: true })
  if (error) return errorResponse('washer.acompte.wero_qr.upload', error, { userId: user.id })

  const { data: { publicUrl } } = admin.storage.from('logos').getPublicUrl(chemin)
  // `?v=` : le chemin est réutilisé à chaque envoi, l'adresse doit changer pour que les
  // navigateurs ne montrent pas l'ancienne image.
  return NextResponse.json({ url: `${publicUrl}?v=${Date.now()}` })
}
