import { notFound } from 'next/navigation'
import LecteurFormationV2 from '@/components/dashboard/LecteurFormationV2'
import { leconsDuPack, packParSlug, trouverLecon } from '@/lib/formation'
import { chargerCatalogue } from '@/lib/formationCatalogue'
import { CadreFormation, contexteFormation } from '../../cadre'

export default async function LeconFormationPage({ params }: { params: Promise<{ slug: string; leconId: string }> }) {
  const { slug, leconId } = await params
  const { washer, liste, admin } = await contexteFormation('formation-lecon')
  const { packs } = await chargerCatalogue({ admin })
  const pack = packParSlug(packs, slug)
  const trouvee = pack ? trouverLecon(pack, leconId) : null
  if (!pack || !trouvee) notFound()

  const lecons = leconsDuPack(pack)
  return (
    <CadreFormation washer={washer}>
      <LecteurFormationV2
        liste={liste}
        packSlug={pack.slug}
        packTitre={pack.titre}
        moduleTitre={trouvee.module.titre}
        lecon={trouvee.lecon}
        precedenteId={lecons[trouvee.index - 1]?.id ?? null}
        suivanteId={lecons[trouvee.index + 1]?.id ?? null}
      />
    </CadreFormation>
  )
}
