import { DemoManipulable } from './demo'
import { getT } from '@/lib/i18n/serveur'

export default async function SectionDemo() {
  const t = await getT()
  return (
    <section className="section" id="demo">
      <div className="w">
        <p className="sur-titre"><span className="pt" />{t('Démo manipulable')}</p>
        <h2 className="h2">{t('Essaie WashBoard.')} <span className="doux">{t('Là, maintenant.')}</span></h2>
        <p className="chapo">{t('Le vrai tableau de bord, version téléphone et version ordinateur, avec une journée fictive. Chaque action se répercute partout : c’est ça, un seul outil.')}</p>
        <DemoManipulable />
      </div>
    </section>
  )
}
