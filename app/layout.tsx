import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da">
      <body className="min-h-screen bg-gray-50">
        <header className="h-16 bg-white border-b flex items-center px-6">
          <span className="font-semibold">Mit Produkt</span>
        </header>

        <main className="max-w-6xl mx-auto p-6">
          {children}
        </main>
      </body>
    </html>
  );
}