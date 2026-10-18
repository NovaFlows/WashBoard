const DOULEURS = [
  { gros: '4', titre: 'messages pour caler un rendez-vous', texte: '« C’est combien ? », « T’es dispo samedi ? », « C’est où ? »… Multiplié par 8 clients par jour, tu passes ta soirée sur WhatsApp.' },
  { gros: '22 h', titre: 'et tu refais tes factures', texte: 'Le client, l’adresse, le prix : tout existe déjà quelque part. Tu le retapes quand même, le soir, dans un autre outil.' },
  { gros: '90 j', titre: 'sans nouvelles d’un bon client', texte: 'Il était ravi. Personne ne l’a relancé, personne ne lui a donné de raison de revenir. Il est parti chez un autre.' },
]

export default function Douleurs() {
  return (
    <section className="section">
      <div className="w">
        <p className="sur-titre"><span className="pt" />Ta journée, aujourd’hui</p>
        <h2 className="h2">Tu laves des voitures. <span className="doux">Pas des messages.</span></h2>
        <div className="douleurs">
          {DOULEURS.map(d => (
            <div className="douleur" key={d.gros}>
              <div className="gros num">{d.gros}</div>
              <h3>{d.titre}</h3>
              <p>{d.texte}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
