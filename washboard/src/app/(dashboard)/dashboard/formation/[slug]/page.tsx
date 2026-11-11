import { notFound } from 'next/navigation'
import PackFormationV2 from '@/components/dashboard/PackFormationV2'
import { packParSlug } from '@/lib/formation'
import { chargerCatalogue } from '@/lib/formationCatalogue'
import { CadreFormation, contexteFormation } from '../cadre'

export default async function PackFormationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { washer, liste, admin } = await contexteFormation('formation-pack')
  const { packs } = await chargerCatalogue({ admin })
  const pack = packParSlug(packs, slug)
  if (!pack) notFound()
  return (
    <CadreFormation washer={washer}>
      <PackFormationV2 liste={liste} pack={pack} />
    </CadreFormation>
  )
}
