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

  // Un fond compresse a 1920 px pese 150 a 500 Ko. La limite laisse une marge
  // confortable tout en refusant ce qui n'est pas passe par la compression :
  // celle-ci rend le fichier d'origine quand elle echoue, et sans limite
  // serree cet echec se traduirait par des megaoctets servis a chaque
  // visiteur.
  if (file.size > 1_500 * 1024) {
    return NextResponse.json(
      { error: 'Image trop lourde. Essayez avec une image plus legere ou de plus petite taille.' },
      { status: 413 },
    )
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
