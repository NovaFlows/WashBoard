import { notFound } from 'next/navigation'
import AdminFormationV2 from '@/components/dashboard/AdminFormationV2'
import { chargerCatalogue } from '@/lib/formationCatalogue'
import { CadreFormation, contexteFormation } from '../cadre'

// Gestion de la formation : réservée aux administrateurs (`FORMATION_ADMIN_USER_IDS`). Les autres
// reçoivent une 404, comme si la page n'existait pas.
export default async function AdminFormationPage() {
  const { washer, admin } = await contexteFormation('formation-admin')
  if (!admin) notFound()
  const { packs } = await chargerCatalogue({ admin: true })
  return (
    <CadreFormation washer={washer}>
      <AdminFormationV2 packs={packs} />
    </CadreFormation>
  )
}
