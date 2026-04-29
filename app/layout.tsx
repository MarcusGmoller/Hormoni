import './globals.css'
import { Inter } from 'next/font/google'
import ConditionalChrome from './components/conditional-chrome'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="da" className={inter.variable}>
      <body className="min-h-screen bg-white font-sans text-slate-900 antialiased">
        <ConditionalChrome>{children}</ConditionalChrome>
      </body>
    </html>
  )
}