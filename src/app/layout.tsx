import type { Metadata } from 'next';
import { GhilandApp } from '@/shell/GhilandApp';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ghiland',
  description: 'The internet as a place.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
        <GhilandApp />
        {children}
      </body>
    </html>
  );
}
