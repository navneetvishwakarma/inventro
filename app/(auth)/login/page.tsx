import { Card } from '@/components/ui/card';
import { LoginForm } from './login-form';

function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-sunken p-4">
      <div className="w-full max-w-[360px]">
        <Card>
          <div className="flex flex-col items-center gap-2 pb-4 text-center">
            <span className="text-lg font-semibold text-primary">Inventro</span>
            <span className="text-sm text-muted-foreground">Log in to your household.</span>
          </div>
          <LoginForm next={safeNextPath(next)} />
        </Card>
      </div>
    </main>
  );
}
