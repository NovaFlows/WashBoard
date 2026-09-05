import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

  // Garde-fou de taille. La compression se fait dans le navigateur, mais rien
  // n'oblige un appelant à passer par là : sans cette limite, un fichier de
  // plusieurs mégaoctets serait servi à chaque visiteur de la page de
  // réservation. C'est ainsi qu'un logo de 4 Mo a fait dépasser de 60 % le
  // quota mensuel de bande passante pendant un pic de trafic.
  const TAILLE_MAX = 2 * 1024 * 1024
  if (file.size > TAILLE_MAX) {
    return NextResponse.json(
      { error: 'Image trop lourde (2 Mo maximum). Réessayez avec une image plus petite.' },
      { status: 413 },
    )
  }

  const bytes = await file.arrayBuffer()
  // Extension déduite du type reçu : forcer le PNG stockait du WebP sous une
  // extension mensongère, et empêchait tout gain de poids.
  const extension = file.type === 'image/webp' ? 'webp' : file.type === 'image/jpeg' ? 'jpg' : 'png'
  const fileName = `${user.id}.${extension}`

  const { error: uploadError } = await createAdminClient().storage
    .from('logos')
    .upload(fileName, bytes, { contentType: file.type || 'image/png', upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = createAdminClient().storage.from('logos').getPublicUrl(fileName)

  const { error: updateError } = await supabase
    .from('washers')
    .update({ logo_url: publicUrl })
    .eq('user_id', user.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ url: publicUrl })
}
