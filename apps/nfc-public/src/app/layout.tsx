import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NFC4you — Hilfe finden, wenn dein Kind sich verirrt',
  description: 'NFC-Bänder mit Notfall-Kontaktdaten. Einfach scannen und Eltern direkt anrufen.',
  robots: { index: false, follow: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0ea5e9',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <main>{children}</main>
        <footer className="px-4 py-6 text-center text-xs text-slate-400 space-x-3">
          <a href="/impressum" className="hover:text-brand-600 hover:underline">Impressum</a>
          <span>·</span>
          <a href="/datenschutz" className="hover:text-brand-600 hover:underline">Datenschutz</a>
          <span>·</span>
          <a href="/agb" className="hover:text-brand-600 hover:underline">AGB</a>
        </footer>
      </body>
    </html>
  );
}
