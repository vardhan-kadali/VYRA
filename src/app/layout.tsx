import type { Metadata } from 'next';
import '../styles/globals.css';
import { AppShell } from '../components/layout/AppShell';

export const metadata: Metadata = {
  title: 'VYRA — Your AI. Your Interview. Your Growth.',
  description: 'A premium AI interview and academic viva preparation platform featuring realistic real-time male AI interviewers.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
