import DirectsFormationV2 from '@/components/dashboard/DirectsFormationV2'
import { SESSIONS_DEMO } from '@/lib/formation'
import { CadreFormation, contexteFormation } from '../cadre'

export default async function DirectsFormationPage() {
  const { washer, liste } = await contexteFormation('formation-directs')
  return (
    <CadreFormation washer={washer}>
      <DirectsFormationV2 liste={liste} sessions={SESSIONS_DEMO} maintenantIso={new Date().toISOString()} />
    </CadreFormation>
  )
}
