import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Filapen Business Hub',
  description: 'Unified finance, creator, and influencer management platform',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1',
};

// Inline script that runs before React hydrates — prevents flash of wrong theme.
// Setzt synchron sowohl die `dark` class (light/dark) als auch das
// `data-theme` Attribut (color-preset). Liest dafür das Zustand-Auth-Store
// aus localStorage damit das Farbschema schon ab dem ersten Paint stimmt
// (sonst wirkt der Theme-Wechsel "broken" weil jeder Page-Load erst mal
// auf Standard zurückfällt bis /me fetcht und der Hook reagiert).
const themeScript = `
(function(){
  try {
    var s = localStorage.getItem('filapen-theme');
    if (s) {
      var t = JSON.parse(s).state?.theme;
      if (t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme:dark)').matches)) {
        document.documentElement.classList.add('dark');
      }
    }
  } catch(e){}
  try {
    var a = localStorage.getItem('filapen-auth');
    if (a) {
      var preset = JSON.parse(a).state?.user?.themePreset;
      if (preset && preset !== 'standard') {
        document.documentElement.setAttribute('data-theme', preset);
      }
    }
  } catch(e){}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-[#0f1117] font-sans antialiased">
        <Providers>
          {children}
        </Providers>
        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={4000}
        />
      </body>
    </html>
  );
}
