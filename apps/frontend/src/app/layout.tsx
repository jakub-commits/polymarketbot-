import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Polymarket Copy Trading Bot',
  description: 'Automated copy trading for Polymarket',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background antialiased`}>
        <div className="relative flex min-h-screen">
          {/* Fixed Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col ml-64">
            <Header />
            <main className="flex-1 p-6 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
