import Link from 'next/link'

export default function Final() {
  return (
    <section className="final">
      <div className="w">
        <h2 className="h2">Tu fais le service.<br /><span className="doux">On gère le reste.</span></h2>
        <p className="chapo" style={{ marginInline: 'auto' }}>Ta page de réservation en ligne en 10 minutes. Un mois offert, sans carte bancaire.</p>
        <div className="heros-cta">
          <Link className="btn btn-accent" href="/signup">Créer mon compte</Link>
          <a className="btn btn-ligne" href="#demo">Revoir la démo</a>
        </div>
      </div>
    </section>
  )
}
