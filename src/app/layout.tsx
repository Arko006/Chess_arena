import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'ChessArena — Secure Online Chess Tournament Platform',
  description: 'Enterprise-grade online chess tournaments with cryptographic invitation links, server-authoritative engine validation, and automated fair-play surveillance.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0e14] text-gray-100 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}