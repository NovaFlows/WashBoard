import { FAQ_ITEMS, type FaqItem } from '@/lib/faq'
import FaqVoirPlus from './FaqVoirPlus'
import { getT } from '@/lib/i18n/serveur'

function Question({ item, t }: { item: FaqItem; t: (fr: string) => string }) {
  return (
    <details>
      <summary>{t(item.q)}</summary>
      <p>{t(item.a)}</p>
    </details>
  )
}

// Même source que le JSON-LD FAQPage (lib/faq.ts) : le texte lu et le balisage ne divergent pas.
// Seules les questions marquées `une` sont dépliées d'office ; les autres suivent derrière « Voir les autres ».
export default async function Faq() {
  const t = await getT()
  const une = FAQ_ITEMS.filter(i => i.une)
  const suite = FAQ_ITEMS.filter(i => !i.une)
  return (
    <section className="section" id="faq">
      <div className="w">
        <p className="sur-titre"><span className="pt" />{t('Questions fréquentes')}</p>
        <h2 className="h2">{t('Ce qu’on nous demande.')}</h2>
        <div className="faq">
          {une.map(item => <Question key={item.q} item={item} t={t} />)}
          {suite.length > 0 && (
            <FaqVoirPlus nombre={suite.length}>
              {suite.map(item => <Question key={item.q} item={item} t={t} />)}
            </FaqVoirPlus>
          )}
        </div>
      </div>
    </section>
  )
}
