import FormationV2 from '@/components/dashboard/FormationV2'
import { SESSIONS_DEMO } from '@/lib/formation'
import { chargerCatalogue } from '@/lib/formationCatalogue'
import { CadreFormation, contexteFormation } from './cadre'

export default async function FormationPage() {
  const { washer, liste, admin } = await contexteFormation('formation')
  const { packs } = await chargerCatalogue({ admin })
  return (
    <CadreFormation washer={washer}>
      <FormationV2 liste={liste} packs={packs} admin={admin} sessions={SESSIONS_DEMO} maintenantIso={new Date().toISOString()} />
    </CadreFormation>
  )
}
