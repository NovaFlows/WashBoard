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

  // Garde-fou de taille, volontairement serré.
  //
  // La compression se fait dans le navigateur et rend des logos de 20 à 80 Ko.
  // Cette limite est six fois plus haute : elle ne gêne aucun envoi normal,
  // mais refuse tout ce qui ne serait PAS passé par la compression — un
  // navigateur qui ne la supporte pas, ou un appel direct à l'API.
  //
  // Le point important : `compressImage` rend le fichier d'origine quand elle
  // échoue, pour ne jamais empêcher quelqu'un de mettre son logo. Sans limite
  // serrée ici, cet échec passerait inaperçu et on servirait de nouveau des
  // mégaoctets à chaque visiteur. C'est ainsi qu'un logo de 4 Mo a fait
  // dépasser de 60 % le quota mensuel de bande passante.
  const TAILLE_MAX = 500 * 1024
  if (file.size > TAILLE_MAX) {
    return NextResponse.json(
      { error: 'Image trop lourde. Essayez avec une image plus légère ou de plus petite taille.' },
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
