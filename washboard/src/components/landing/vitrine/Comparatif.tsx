import { besoinsHead, besoinsRows } from '@/lib/comparatifAuto'
import { getT } from '@/lib/i18n/serveur'

export default async function Comparatif() {
  const t = await getT()
  return (
    <section className="section" id="comparatif">
      <div className="w">
        <p className="sur-titre"><span className="pt" />{t('Comparatif')}</p>
        <h2 className="h2">{t('Trois façons de gérer.')} <span className="doux">{t('Aucune n’est absurde.')}</span></h2>
        <p className="chapo">{t('Pas de note ni de verdict : chaque besoin, comparé pour ce qu’il est.')}</p>
        {/* tabIndex : une zone qui défile doit être atteignable au clavier. */}
        <div className="tab-defile" tabIndex={0} role="region" aria-label={t('Comparatif des trois façons de gérer')}>
          <table className="tab">
            <thead><tr>{besoinsHead.map(c => <th key={c} scope="col">{t(c)}</th>)}</tr></thead>
            <tbody>{besoinsRows.map(r => <tr key={r[0]}>{r.map((c, i) => i === 0 ? <th key={i} scope="row">{t(c)}</th> : <td key={i}>{t(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
