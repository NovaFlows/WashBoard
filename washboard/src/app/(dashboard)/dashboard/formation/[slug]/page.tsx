import { notFound } from 'next/navigation'
import PackFormationV2 from '@/components/dashboard/PackFormationV2'
import { CATALOGUE_DEMO, packParSlug } from '@/lib/formation'
import { CadreFormation, contexteFormation } from '../cadre'

export default async function PackFormationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { washer, liste } = await contexteFormation('formation-pack')
  const pack = packParSlug(CATALOGUE_DEMO, slug)
  if (!pack) notFound()
  return (
    <CadreFormation washer={washer}>
      <PackFormationV2 liste={liste} pack={pack} />
    </CadreFormation>
  )
}
