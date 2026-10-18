import { DemoManipulable } from './demo'

export default function SectionDemo() {
  return (
    <section className="section" id="demo">
      <div className="w">
        <p className="sur-titre"><span className="pt" />Démo manipulable</p>
        <h2 className="h2">Essaie WashBoard. <span className="doux">Là, maintenant.</span></h2>
        <p className="chapo">Le vrai tableau de bord, version téléphone et version ordinateur, avec une journée fictive. Chaque action se répercute partout : c’est ça, un seul outil.</p>
        <DemoManipulable />
      </div>
    </section>
  )
}
