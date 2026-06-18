import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { NavBar } from '@/components/ui/NavBar';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <ThemeProvider defaultTheme="night">
      <div
        className="min-h-screen"
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        <NavBar userEmail={user.email!} />
        <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      </div>
    </ThemeProvider>
  );
}