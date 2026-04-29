import Link from 'next/link'
import { Phone, Mail, Users } from 'lucide-react'

function IconLinkedIn({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

type MarketingFooterProps = {
  /** Brug `"/"` på undersider så interne links peger på forsiden. */
  anchorBase?: string
}

export default function MarketingFooter({ anchorBase = '' }: MarketingFooterProps) {
  const hash = (id: string) => `${anchorBase}#${id}`

  return (
    <footer className="border-t border-black/5 bg-[#F9F9F9] px-6 py-16">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
        <div>
          <p className="text-lg font-bold text-[#333333]">Hormoni(e)</p>
          <p className="mt-2 text-sm text-[#666666]">Din partner gennem overgangsalderen</p>
          <ul className="mt-8 space-y-3 text-sm text-[#4a4a4a]">
            <li>
              <Link href="/community" className="transition hover:text-[#333333]">
                Vores community
              </Link>
            </li>
            <li>
              <a href={hash('om')} className="transition hover:text-[#333333]">
                Vores faglige tilgang
              </a>
            </li>
            <li>
              <a href={hash('om')} className="transition hover:text-[#333333]">
                Vores team
              </a>
            </li>
            <li>
              <a href={hash('saadan')} className="transition hover:text-[#333333]">
                Sådan fungerer det
              </a>
            </li>
            <li>
              <Link href="/priser" className="transition hover:text-[#333333]">
                Priser
              </Link>
            </li>
            <li>
              <Link href="/priser#faq" className="transition hover:text-[#333333]">
                FAQ
              </Link>
            </li>
            <li>
              <a href={hash('om')} className="transition hover:text-[#333333]">
                Privatlivspolitik
              </a>
            </li>
            <li>
              <a href={hash('om')} className="transition hover:text-[#333333]">
                Vilkår og betingelser
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-lg font-bold text-[#333333]">Connect</p>
          <ul className="mt-8 space-y-4 text-sm text-[#4a4a4a]">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-[#849b87]" />
              <a href="tel:+4570172018" className="hover:text-[#333333]">
                +45 70172018
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-[#849b87]" />
              <a href="mailto:kontakt@hormonie.com" className="hover:text-[#333333]">
                kontakt@hormonie.com
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-[#849b87]" />
              <Link href="/community" className="hover:text-[#333333]">
                Community
              </Link>
            </li>
            <li className="flex items-center gap-2">
              <IconLinkedIn className="h-4 w-4 shrink-0 text-[#849b87]" />
              <span>LinkedIn</span>
            </li>
            <li className="flex items-center gap-2">
              <IconInstagram className="h-4 w-4 shrink-0 text-[#849b87]" />
              <span>Instagram</span>
            </li>
            <li className="flex items-center gap-2">
              <IconFacebook className="h-4 w-4 shrink-0 text-[#849b87]" />
              <span>Facebook</span>
            </li>
            <li className="flex items-center gap-2 text-[#849b87]">
              <span className="text-xs font-bold">@</span>
              <span>Threads</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-14 max-w-6xl border-t border-black/10 pt-8 text-center text-xs text-[#777777]">
        © {new Date().getFullYear()} Hormoni(e). Alle rettigheder forbeholdes.
      </div>
    </footer>
  )
}
