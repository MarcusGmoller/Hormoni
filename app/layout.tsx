import './globals.css';
import Navbar from './components/navbar';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da">
      <body className="min-h-screen bg-gray-50">
        <header className="border-b bg-white">
          <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
            <span className="text-lg font-semibold">Mit Produkt</span>
            <Navbar />
          </div>
        </header>

        <main className="mx-auto max-w-6xl p-6">
          {children}
        </main>
      </body>
    </html>
  );
}