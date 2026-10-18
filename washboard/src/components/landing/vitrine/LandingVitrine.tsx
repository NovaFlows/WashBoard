import Comparatif from './Comparatif'
import CoteClient from './CoteClient'
import CreneauxGroupes from './CreneauxGroupes'
import { DemoProvider } from './demo'
import Douleurs from './Douleurs'
import Facturation from './Facturation'
import Faq from './Faq'
import Fidelite from './Fidelite'
import Final from './Final'
import Heros from './Heros'
import Journee from './Journee'
import Navigation from './Navigation'
import PiedDePage from './PiedDePage'
import SectionDemo from './SectionDemo'
import Tarifs from './Tarifs'
import ToutEnUn from './ToutEnUn'
import './vitrine.css'

// Page d'accueil (refonte 2026). Un seul DemoProvider : le héros, la démo et la page de
// réservation lisent et modifient la même journée fictive.
export default function LandingVitrine() {
  return (
    <div className="wb-vitrine" id="haut">
      <DemoProvider>
        <Navigation />
        <main id="main-content">
          <Heros />
          <Douleurs />
          <Journee />
          <SectionDemo />
          <CoteClient />
          <Facturation />
          <Fidelite />
          <CreneauxGroupes />
          <ToutEnUn />
          <Comparatif />
          <Tarifs />
          <Faq />
          <Final />
        </main>
        <PiedDePage />
      </DemoProvider>
    </div>
  )
}
