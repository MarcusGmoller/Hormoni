import Image from 'next/image'
import { BookOpen } from 'lucide-react'
import MarketingSiteHeader from '@/components/marketing/MarketingSiteHeader'

const articles = [
  {
    title: 'Hvad er overgangsalder',
    description: 'Få indblik i overgangsalderens faser og hvad der sker i kroppen',
    image:
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=900&q=80',
    alt: 'Person i yoga mod aftenhimmel',
  },
  {
    title: 'Perimenopausen',
    description: 'Forstå symptomerne og forandringerne i den tidlige overgangsalder',
    image:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=900&q=80',
    alt: 'Professionel kvinde',
  },
  {
    title: 'Postmenopausen',
    description: 'Livet efter overgangsalderen og langsigtede sundhedshensyn',
    image:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=80',
    alt: 'Stille natur ved vand',
  },
  {
    title: 'Østrogen',
    description: 'Østrogens rolle i kroppen og effekten af faldende niveauer',
    image:
      'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=80',
    alt: 'Blomster',
  },
  {
    title: 'Progesteron',
    description: 'Læs om progesteron og dets betydning for hormonbalancen',
    image:
      'https://images.unsplash.com/photo-1559757172-3e21e4e8c7bb?auto=format&fit=crop&w=900&q=80',
    alt: 'Anatomisk model',
  },
  {
    title: 'Testosteron',
    description: 'Testosteronens funktion hos kvinder og påvirkning i overgangsalderen',
    image:
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=80',
    alt: 'Sundhedsprofessionel',
  },
] as const

export default function VidenPage() {
  return (
    <div className="min-h-screen bg-white text-[#333333]">
      <MarketingSiteHeader anchorBase="/" currentPage="viden" />

      <main className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <header className="mb-12 md:mb-16">
          <div className="mb-5 flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#849b87]/15 text-[#849b87]"
              aria-hidden
            >
              <BookOpen className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#333333] md:text-4xl">Viden</h1>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-[#777777] md:text-lg">
            Lær om overgangsalderen, hormoner og symptomer
          </p>
        </header>

        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((item) => (
            <li key={item.title}>
              <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                <div className="relative aspect-video w-full shrink-0 bg-neutral-100">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5 md:p-6">
                  <h2 className="text-lg font-bold text-[#333333]">{item.title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[#777777]">{item.description}</p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
