import { besoinsHead, besoinsRows } from '@/lib/comparatifAuto'

export default function Comparatif() {
  return (
    <section className="section" id="comparatif">
      <div className="w">
        <p className="sur-titre"><span className="pt" />Comparatif</p>
        <h2 className="h2">Trois façons de gérer. <span className="doux">Aucune n’est absurde.</span></h2>
        <p className="chapo">Pas de note ni de verdict : chaque besoin, comparé pour ce qu’il est.</p>
        {/* tabIndex : une zone qui défile doit être atteignable au clavier. */}
        <div className="tab-defile" tabIndex={0} role="region" aria-label="Comparatif des trois façons de gérer">
          <table className="tab">
            <thead><tr>{besoinsHead.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>{besoinsRows.map(r => <tr key={r[0]}>{r.map((c, i) => i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
