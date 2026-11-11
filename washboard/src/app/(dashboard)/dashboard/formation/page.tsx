import FormationV2 from '@/components/dashboard/FormationV2'
import { CATALOGUE_DEMO, SESSIONS_DEMO } from '@/lib/formation'
import { CadreFormation, contexteFormation } from './cadre'

export default async function FormationPage() {
  const { washer, liste } = await contexteFormation('formation')
  return (
    <CadreFormation washer={washer}>
      <FormationV2 liste={liste} packs={CATALOGUE_DEMO} sessions={SESSIONS_DEMO} maintenantIso={new Date().toISOString()} />
    </CadreFormation>
  )
}
