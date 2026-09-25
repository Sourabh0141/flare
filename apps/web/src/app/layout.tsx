import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppProviders } from '@/components/providers/app-providers';
import { SITE } from '@/lib/config';
import '@/styles/globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['opsz', 'wdth'],
  display: 'swap',
  variable: '--font-bricolage',
});

export const metadata: Metadata = {
  title: {
    default: `${SITE.name}: ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  robots: { index: true, follow: true },
  openGraph: {
    title: `${SITE.name}: ${SITE.tagline}`,
    description: SITE.description,
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#15120f',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={bricolage.variable}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
