import Image from 'next/image'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function BookingHero({ name, message, accent, logoUrl, personalized, background, whatsappHref, reviews }: {
  name: string
  message?: string | null
  accent: string
  logoUrl?: string | null
  personalized: boolean
  background?: React.CSSProperties | null
  whatsappHref?: string | null
  reviews?: React.ReactNode
}) {
  return <header className="wb-booking-hero text-white" style={{ backgroundColor: accent, ...background }}>
    <div className="max-w-lg mx-auto px-6 pt-4 pb-12">
      <div className="flex items-center justify-between mb-4">
        {/* Logo du laveur agrandi ×1.5 (40px → 60px, demande d'Alexandre, 2026-10-04) —
            son repli (initiales) suit la même taille, même emplacement visuel. Le
            logo WashBoard (offre gratuite) n'est pas concerné : ce n'est pas le logo
            d'un laveur. */}
        {personalized ? logoUrl ? <Image src={logoUrl} alt={name} width={60} height={60} className="w-[60px] h-[60px] rounded-full object-cover" />
          : <span className="w-[60px] h-[60px] rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">{name.split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase()}</span>
          : <span className="text-sm font-bold flex items-center gap-2"><Image src="/LogoWashBoard.png" alt="" width={36} height={36} />WashBoard</span>}
        <div className="flex items-center gap-2">
          {whatsappHref && <a href={whatsappHref} aria-label="Contacter le laveur sur WhatsApp" target="_blank" rel="noopener noreferrer" className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></svg>
          </a>}
          <div className="[&_button]:rounded-full [&_button]:w-11 [&_button]:h-11 [&_button]:border-0 [&_button]:bg-white/15 [&_button]:text-white"><ThemeToggle /></div>
        </div>
      </div>
      <h1 className="text-[26px] leading-tight font-bold tracking-[-.04em]">{name}</h1>
      <p className="mt-1.5 text-sm leading-snug text-white/90 max-w-sm">{message || 'Lavage à domicile. Trois questions et c’est réservé.'}</p>
      <div className="mt-6 mb-6">
        <p className="text-xs font-semibold text-white/90 mb-1">Votre prochain lavage</p>
        <p className="text-[clamp(2rem,9vw,3rem)] leading-none font-bold tracking-[-.045em]">À votre domicile.</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold">
        {reviews}
        <span className="flex items-center gap-2"><span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-white" />Paiement sur place</span>
      </div>
    </div>
  </header>
}
