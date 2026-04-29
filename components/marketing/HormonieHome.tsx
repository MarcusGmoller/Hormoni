import Image from 'next/image'
import Link from 'next/link'
import { Check, Activity, CalendarDays, Moon } from 'lucide-react'
import MarketingSiteHeader from '@/components/marketing/MarketingSiteHeader'
import MarketingFooter from '@/components/marketing/MarketingFooter'

const sage = '#849b87'
const sageBtn = 'bg-[#849b87] hover:bg-[#738a7a]'
const terracotta = '#D68E77'
const terracottaBtn = 'bg-[#D68E77] hover:bg-[#c47a65]'

export default function HormonieHome() {
  return (
    <div className="min-h-screen bg-white text-[#333333]">
      <MarketingSiteHeader />

      {/* Hero */}
      <section className="relative min-h-[min(88vh,820px)] w-full">
        <Image
          src="/landing/hero.jpg"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/45 to-black/25" />
        <div className="relative mx-auto flex max-w-6xl flex-col justify-center px-6 pb-20 pt-24 md:min-h-[min(88vh,820px)] md:pt-32">
          <h1 className="max-w-xl text-3xl font-bold leading-tight text-white md:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
            Overgangsalderen er ikke bare en overgang. Det er en ny livsfase.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/95 md:text-lg">
            Hos Hormoni(e) får du et sammenhængende personligt forløb.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className={`inline-flex w-fit items-center justify-center rounded-full px-8 py-3.5 text-sm font-semibold text-white shadow-md transition ${sageBtn}`}
            >
              Start dit forløb i dag
            </Link>
            <Link
              href="/professionals"
              className="inline-flex items-center gap-1 text-sm font-medium text-white underline decoration-white/70 underline-offset-4 transition hover:decoration-white"
            >
              Book en uforpligtende samtale →
            </Link>
          </div>
        </div>
      </section>

      {/* Om Hormoni(e) */}
      <section id="om" className="scroll-mt-24 bg-white px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-xl font-bold text-[#333333]">Om Hormoni(e)</h2>
          <h3 className="mt-10 text-xl font-bold text-[#333333] md:text-2xl">
            Hvor går du hen, når kroppen forandrer sig?
          </h3>
          <p className="mt-4 leading-relaxed text-[#4a4a4a]">
            De fleste kvinder leder mange steder: på nettet, i lukkede grupper, hos veninder og læger. Men svarene er
            ofte spredte. Forløbet bliver fragmenteret. Og overblikket mangler.
          </p>
          <p className="mt-4 leading-relaxed text-[#4a4a4a]">
            Samtidig oplever næsten alle kvinder over 40 symptomer på overgangsalderen – og mange møder lange
            ventetider i det offentlige eller høje priser privat.
          </p>
          <p className="mt-6 font-bold text-[#333333]">Det ville vi gøre anderledes.</p>
          <p className="mt-4 leading-relaxed text-[#4a4a4a]">
            Hormoni(e) samler viden, behandling, et personligt overblik og fællesskab – ét sted, ét forløb.
          </p>

          <div className="mt-10 rounded-2xl bg-[#F5F7F7] p-8 md:p-10">
            <p className="font-bold text-[#333333]">Hos os får du:</p>
            <ul className="mt-6 space-y-4">
              {[
                'Online udredning ved specialiserede læger og sundhedsfaglige rådgivere',
                'Et evidensbaseret vidensunivers om krop, hormoner, kost og træning',
                'En personlig profil, der giver dig overblik over din udvikling',
                'Et fællesskab med andre kvinder i samme livsfase',
              ].map((line) => (
                <li key={line} className="flex gap-3 text-[#4a4a4a]">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: sage }}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span className="leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-10 leading-relaxed text-[#4a4a4a]">
            Vi arbejder efter en struktureret, evidensbaseret metode, under gældende kliniske retningslinjer hvor din
            behandling tilpasses løbende. Vores behandlere arbejder inden for fælles kliniske rammer og retningslinjer,
            så du får et sammenhængende og trygt forløb – uanset hvem du møder.
          </p>

          <blockquote className="mt-10 border-l-4 border-[#C4A574] pl-6 text-[#4a4a4a] leading-relaxed">
            <p>I dag findes der mange enkeltstående løsninger:</p>
            <p className="mt-2">Nogle tilbyder behandling. Andre tilbyder viden. Nogle tilbyder tracking.</p>
            <p className="mt-4 font-medium text-[#333333]">Men ingen samler det hele. Det gør vi.</p>
          </blockquote>

          <p className="mx-auto mt-14 max-w-2xl text-center text-base italic leading-relaxed text-[#555555]">
            Hormoni(e) er skabt til dig, der ikke vil nøjes med halve svar – men ønsker en løsning, der følger dig hele
            vejen.
          </p>
        </div>
      </section>

      {/* Mænd */}
      <section className="bg-[#FAF7F2] px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-[#333333]">Mister du gnisten?</h2>
          <p className="mt-6 leading-relaxed text-[#4a4a4a]">
            Hormonelle forandringer påvirker også mænd – og kan have betydning for energi, lyst og overskud.
          </p>
          <p className="mt-4 leading-relaxed text-[#4a4a4a]">
            Med den rette indsigt og vejledning kan du genfinde balancen i din krop.
          </p>
          <p className="mt-4 leading-relaxed text-[#4a4a4a]">
            Vi tilbyder individuel vurdering og rådgivning til mænd, tilpasset din situation og dine behov.
          </p>
          <Link
            href="#om"
            className={`mt-10 inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-semibold text-white shadow-sm transition ${sageBtn}`}
          >
            Læs mere her →
          </Link>
        </div>
      </section>

      {/* Priser */}
      <section id="priser" className="scroll-mt-24 bg-[#F9F9F9] px-6 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-2xl font-bold text-[#333333]">Hormoni(e)</h2>
          <p className="mt-2 text-lg text-[#555555]">Din vej til balance</p>
          <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-[#666666]">
            Du skal ikke selv finde rundt i symptomer, hormoner og løsninger. Vi guider dig i et forløb, der passer til
            din krop og din livsfase.
          </p>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-[#666666]">
            Hormonelle forandringer er ikke stationære, de forandrer sig hele livet. Derfor tilbyder Hormoni(e) et
            abonnement tilpasset dig og dine behov.
          </p>

          <div className="mt-14 grid gap-8 md:grid-cols-2 md:items-stretch">
            <div className="flex flex-col rounded-2xl bg-white p-8 text-left shadow-sm ring-1 ring-black/5">
              <h3 className="text-lg font-bold text-[#333333]">Start med et personligt forløb</h3>
              <p className="text-sm text-[#777777]">Abonnement</p>
              <p className="mt-6 text-3xl font-bold text-[#333333]">
                750,-/md <span className="text-base font-normal text-[#777777]"> </span>
              </p>
              <p className="text-sm text-[#777777]">helt uden binding</p>
              <ul className="mt-8 flex-1 space-y-3 text-sm leading-relaxed text-[#4a4a4a]">
                {[
                  'Personlig screening og vurdering',
                  'Online konsultationer hos læger med speciale i hormonbalance og (peri)menopause',
                  'Individuel behandlingsplan',
                  'Løbende opfølgning',
                  'Skriv med eksperter direkte i appen',
                  'Din personlige profil med overblik over dit forløb og din udvikling',
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: sage }} strokeWidth={2.5} />
                    {t}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`mt-8 block w-full rounded-full py-3.5 text-center text-sm font-semibold text-white transition ${sageBtn}`}
              >
                Start dit forløb
              </Link>
            </div>

            <div className="flex flex-col rounded-2xl bg-white p-8 text-left shadow-sm ring-1 ring-black/5">
              <h3 className="text-lg font-bold text-[#333333]">Fortsæt i dit tempo</h3>
              <p className="text-sm text-[#777777]">Abonnement</p>
              <p className="mt-6 text-3xl font-bold text-[#333333]">350,-/md</p>
              <p className="text-sm text-[#777777]">helt uden binding</p>
              <ul className="mt-8 flex-1 space-y-3 text-sm leading-relaxed text-[#4a4a4a]">
                {[
                  'Symptomer og udvikling samlet ét sted',
                  'Direkte beskeder med behandlere',
                  'Adgang til community',
                  'Mulighed for at tilkøbe konsultationer',
                  'Din personlige profil med overblik over dit forløb og din udvikling',
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: terracotta }} strokeWidth={2.5} />
                    {t}
                  </li>
                ))}
              </ul>
              <Link
                href="/userdashboard/subscription"
                className={`mt-8 block w-full rounded-full py-3.5 text-center text-sm font-semibold text-white transition ${terracottaBtn}`}
              >
                Se medlemskab
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Profil / app preview */}
      <section id="saadan" className="scroll-mt-24 bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-[#333333] md:text-[1.65rem]">Din personlige profil</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-[#666666]">
              Følg din udvikling og se din fremgang over tid. Din personlige profil giver dig et klart overblik over dit
              forløb, så du og din behandler kan justere behandlingen efter dine behov.
            </p>
          </div>

          <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:items-start">
            <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-md md:p-8">
              <div className="flex items-center gap-2 text-[#333333]">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#849b87]/20 text-[#5a6e5f]">
                  <Moon className="h-4 w-4" />
                </span>
                <span className="font-semibold">Søvnkvalitet</span>
              </div>
              <div className="relative mt-6 aspect-[16/10] w-full">
                <svg viewBox="0 0 400 220" className="h-full w-full" aria-hidden>
                  <line x1="48" y1="20" x2="48" y2="180" stroke="#e5e7eb" strokeWidth="1" />
                  <line x1="48" y1="180" x2="380" y2="180" stroke="#e5e7eb" strokeWidth="1" />
                  {['Start', 'Uge 1', 'Uge 2', 'Uge 3', 'Uge 4', 'Uge 5', 'Uge 6'].map((label, i) => (
                    <text key={label} x={48 + i * 52} y="205" fontSize="10" fill="#6b7280" textAnchor="middle">
                      {label}
                    </text>
                  ))}
                  <text x="8" y="100" fontSize="9" fill="#b91c1c">
                    Lav 1
                  </text>
                  <text x="8" y="28" fontSize="9" fill="#15803d">
                    10 Høj
                  </text>
                  <path
                    d="M 60 150 L 112 140 L 164 120 L 216 95 L 268 70 L 320 55 L 372 48"
                    fill="none"
                    stroke="#3d5c45"
                    strokeWidth="2.5"
                  />
                  {[
                    [60, 150],
                    [112, 140],
                    [164, 120],
                    [216, 95],
                    [268, 70],
                    [320, 55],
                    [372, 48],
                  ].map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="5" fill="#3d5c45" />
                  ))}
                </svg>
              </div>
              <div className="mt-4 flex gap-6 text-xs text-[#666666]">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#a8c4a8]" /> Baggrund
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#3d5c45]" /> Din udvikling
                </span>
              </div>
            </div>

            <div className="space-y-10">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#849b87]/20 text-[#5a6e5f]">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-[#333333]">Visualiser din fremgang</h3>
                  <p className="mt-2 leading-relaxed text-[#4a4a4a]">
                    Se dine symptomer udvikle sig over tid med klare grafer og indsigter. Identificer mønstre og
                    fremskridt i din behandling.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#849b87]/20 text-[#5a6e5f]">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-[#333333]">Samlet overblik</h3>
                  <p className="mt-2 leading-relaxed text-[#4a4a4a]">
                    Din behandlingsplan, kommende aftaler, og tidligere konsultationer samlet ét sted – så du altid har
                    overblikket.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Viden teaser */}
      <section id="viden" className="scroll-mt-24 border-t border-black/5 bg-[#F9F9F9] px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-xl font-bold text-[#333333]">Viden</h2>
          <p className="mt-4 leading-relaxed text-[#4a4a4a]">
            Et evidensbaseret vidensunivers om krop, hormoner, kost og træning – bygget til din livsfase. Mere indhold
            kommer løbende.
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
