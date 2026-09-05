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

  // 5 Mo etait bien trop large pour une image servie a chaque visiteur : le
  // fond est desormais compresse dans le navigateur, 3 Mo suffisent largement
  // comme garde-fou.
  if (file.size > 3 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image trop lourde (3 Mo maximum)' }, { status: 413 })
  }

  const bytes = await file.arrayBuffer()
  // Le WebP manquait : un fond compresse dans ce format etait stocke en .jpg,
  // avec un type qui ne correspondait pas au contenu.
  const ext   = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg'
  const fileName = `${user.id}.${ext}`

  const { error: uploadError } = await createAdminClient().storage
    .from('backgrounds')
    .upload(fileName, bytes, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = createAdminClient().storage.from('backgrounds').getPublicUrl(fileName)

  const { error: updateError } = await supabase
    .from('washers')
    .update({ background_theme: publicUrl })
    .eq('user_id', user.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ url: publicUrl })
}
