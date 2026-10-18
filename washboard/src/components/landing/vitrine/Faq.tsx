import { FAQ_ITEMS } from '@/lib/faq'

// Même source que le JSON-LD FAQPage (lib/faq.ts) : le texte lu et le balisage ne divergent pas.
export default function Faq() {
  return (
    <section className="section" id="faq">
      <div className="w">
        <p className="sur-titre"><span className="pt" />Questions fréquentes</p>
        <h2 className="h2">Ce qu’on nous demande.</h2>
        <div className="faq">
          {FAQ_ITEMS.map(item => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
