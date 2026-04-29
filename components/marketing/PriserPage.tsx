import Link from 'next/link'
import { Check, ArrowRight, MessageCircle } from 'lucide-react'
import MarketingSiteHeader from '@/components/marketing/MarketingSiteHeader'
import MarketingFooter from '@/components/marketing/MarketingFooter'

const sageBtn = 'bg-[#849b87] hover:bg-[#738a7a]'
const terracottaBtn = 'bg-[#D18B74] hover:bg-[#c47a65]'

const plan1Features = [
  'Personlig screening og vurdering',
  'Online konsultationer hos læger med speciale i hormonbalance',
  'Individuel behandlingsplan',
  'Løbende opfølgning',
  'Skriv med eksperter direkte i appen',
  'Din personlige profil med overblik',
  'Community adgang',
]

const plan2Features = [
  'Fortsat adgang til platformen',
  'Direkte beskeder med behandlere',
  'Symptomtracking og indsigter',
  'Community adgang',
  'Din personlige profil med overblik',
  'Mulighed for tilkøb af konsultationer',
]

const plan3Features = [
  '20 minutters konsultation',
  'Video eller fysisk møde',
  'Kan tilkøbes til medlemskab',
  'Book når du har behov',
]

const faqItems = [
  {
    q: 'Kan jeg opsige når som helst?',
    a: 'Ja, der er ingen binding. Du kan opsige dit medlemskab med 30 dages varsel.',
  },
  {
    q: 'Hvad sker der efter det personlige forløb?',
    a: 'Du kan vælge at fortsætte på Balance medlemskab til 350,-/måned og tilkøbe konsultationer efter behov for 495,- per styk.',
  },
  {
    q: 'Er medicin inkluderet i prisen?',
    a: 'Nej, medicin betales separat via dit normale apotek. Recepter udstedes af din behandler.',
  },
]

export default function PriserPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#333333]">
      <MarketingSiteHeader anchorBase="/" currentPage="priser" />

      <main className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <header className="mx-auto mb-14 max-w-3xl text-center">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#333333] md:text-[2rem]">
            Vælg den plan der passer dig
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#777777] md:text-lg">
            Fleksible medlemskaber der følger din rejse gennem overgangsalderen
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-3 lg:items-stretch">
          {/* Card 1 — Anbefalet */}
          <article className="relative flex flex-col rounded-2xl border-2 border-[#849b87]/35 bg-white p-8 shadow-sm">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-block rounded-full bg-[#849b87] px-4 py-1 text-xs font-semibold text-white">
                Anbefalet
              </span>
            </div>
            <h2 className="mt-4 text-xl font-bold text-[#333333]">Personligt forløb</h2>
            <p className="mt-1 text-sm text-[#777777]">3-6 måneders opstartsforløb</p>
            <p className="mt-6 text-3xl font-bold text-[#333333]">750,-/md</p>
            <p className="text-sm text-[#777777]">helt uden binding</p>
            <ul className="mt-8 flex-1 space-y-3 text-sm leading-relaxed text-[#4a4a4a]">
              {plan1Features.map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#9ca3af]" strokeWidth={2.5} />
                  {t}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className={`mt-8 block w-full rounded-full py-3.5 text-center text-sm font-semibold text-white transition ${sageBtn}`}
            >
              Start forløb
            </Link>
          </article>

          {/* Card 2 */}
          <article className="flex flex-col rounded-2xl border border-black/[0.08] bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-[#333333]">Balance medlemskab</h2>
            <p className="mt-1 text-sm text-[#777777]">Når balancen er fundet</p>
            <p className="mt-6 text-3xl font-bold text-[#333333]">350,-/md</p>
            <p className="text-sm text-[#777777]">helt uden binding</p>
            <ul className="mt-8 flex-1 space-y-3 text-sm leading-relaxed text-[#4a4a4a]">
              {plan2Features.map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#9ca3af]" strokeWidth={2.5} />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-xl bg-[#f3f4f6] px-4 py-3 text-center text-xs leading-relaxed text-[#64748b]">
              Tilgængelig efter gennemført personligt forløb
            </div>
          </article>

          {/* Card 3 */}
          <article className="flex flex-col rounded-2xl border border-black/[0.08] bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-[#333333]">Opfølgende konsultation</h2>
            <p className="mt-1 text-sm text-[#777777]">20 minutter og 495 kr</p>
            <p className="mt-6 text-3xl font-bold text-[#333333]">495,-</p>
            <p className="text-sm text-[#777777]">per konsultation</p>
            <ul className="mt-8 flex-1 space-y-3 text-sm leading-relaxed text-[#4a4a4a]">
              {plan3Features.map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#9ca3af]" strokeWidth={2.5} />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-xl bg-[#f3f4f6] px-4 py-3 text-center text-xs leading-relaxed text-[#64748b]">
              Tilgængelig efter gennemført personligt forløb
            </div>
          </article>
        </div>

        {/* Overgang */}
        <section
          className="mt-16 overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-r from-[#e8efe9] via-[#f5f2eb] to-[#faf8f5] px-6 py-8 md:px-10 md:py-10"
          aria-labelledby="overgang-heading"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#5a6e5f] text-white shadow-sm"
              aria-hidden
            >
              <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1 space-y-4 text-sm leading-relaxed text-[#4a4a4a] md:text-[0.9375rem]">
              <h2 id="overgang-heading" className="font-serif text-xl font-bold text-[#1e293b] md:text-2xl">
                Hvordan fungerer overgangen?
              </h2>
              <p>
                <strong className="text-[#333333]">Personligt forløb — Balance medlemskab:</strong> Når du har fundet
                din balance, kan du nemt skifte til et løbende medlemskab til 350,-/måned. Du beholder adgang til
                platformen, beskeder og community og din egen profil.
              </p>
              <p>
                <strong className="text-[#333333]">Tilkøb:</strong> Som medlem af balance medlemskab kan du til enhver
                tid tilkøbe opfølgende konsultationer for 495,- per styk.
              </p>
              <p>
                <strong className="text-[#333333]">Fleksibilitet:</strong> Du kan altid opgradere eller nedgradere dit
                medlemskab efter behov.
              </p>
            </div>
          </div>
        </section>

        {/* Beskeder */}
        <section className="mx-auto mt-16 max-w-3xl rounded-2xl border-2 border-[#D68E77]/50 bg-white px-6 py-10 text-center shadow-sm md:px-12 md:py-12">
          <div className="mx-auto mb-5 flex justify-center text-[#D68E77]" aria-hidden>
            <MessageCircle className="h-10 w-10" strokeWidth={1.5} />
          </div>
          <h2 className="font-serif text-xl font-bold text-[#1e293b] md:text-2xl">
            Beskeder inkluderet i alle medlemskaber
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#4a4a4a] md:text-base">
            Uanset hvilket medlemskab du vælger, har du altid adgang til at skrive beskeder til din behandler. Vi svarer
            typisk inden for 24 timer på hverdage. Denne funktion er kernen i vores platform.
          </p>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto mt-20 max-w-3xl scroll-mt-28">
          <h2 className="mb-10 text-center font-serif text-2xl font-bold text-[#1e293b] md:text-3xl">
            Ofte stillede spørgsmål
          </h2>
          <ul className="space-y-4">
            {faqItems.map((item) => (
              <li
                key={item.q}
                className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
              >
                <p className="font-bold text-[#333333]">{item.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#64748b]">{item.a}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="mx-auto mt-20 max-w-xl text-center">
          <h2 className="font-serif text-2xl font-bold text-[#1e293b]">Klar til at starte?</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#64748b] md:text-base">
            Book en gratis samtale og find ud af hvilken plan der passer bedst til dig
          </p>
          <Link
            href="/professionals"
            className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold text-white shadow-md transition ${terracottaBtn}`}
          >
            Book gratis samtale
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      </main>

      <MarketingFooter anchorBase="/" />
    </div>
  )
}
