import { FAQ_ITEMS, type FaqItem } from '@/lib/faq'
import FaqVoirPlus from './FaqVoirPlus'

function Question({ item }: { item: FaqItem }) {
  return (
    <details>
      <summary>{item.q}</summary>
      <p>{item.a}</p>
    </details>
  )
}

// Même source que le JSON-LD FAQPage (lib/faq.ts) : le texte lu et le balisage ne divergent pas.
// Seules les questions marquées `une` sont dépliées d'office ; les autres suivent derrière « Voir les autres ».
export default function Faq() {
  const une = FAQ_ITEMS.filter(i => i.une)
  const suite = FAQ_ITEMS.filter(i => !i.une)
  return (
    <section className="section" id="faq">
      <div className="w">
        <p className="sur-titre"><span className="pt" />Questions fréquentes</p>
        <h2 className="h2">Ce qu’on nous demande.</h2>
        <div className="faq">
          {une.map(item => <Question key={item.q} item={item} />)}
          {suite.length > 0 && (
            <FaqVoirPlus nombre={suite.length}>
              {suite.map(item => <Question key={item.q} item={item} />)}
            </FaqVoirPlus>
          )}
        </div>
      </div>
    </section>
  )
}
