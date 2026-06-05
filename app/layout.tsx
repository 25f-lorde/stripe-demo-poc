import type { Metadata } from 'next';
import { DM_Serif_Display, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const dmSerif = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-serif',
});

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-instrument',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'BillFlow — Subscription Billing Demo',
  description: 'A Stripe subscription billing demo built with Next.js',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSerif.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        {children}
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
