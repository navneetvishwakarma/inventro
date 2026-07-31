import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { submitPasscode } from './actions';

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-sunken p-4">
      <div className="w-full max-w-[360px]">
        <Card>
          <div className="flex flex-col items-center gap-2 pb-4 text-center">
            <span className="text-lg font-semibold text-primary">Inventro</span>
            <span className="text-sm text-muted-foreground">Household grocery ledger — enter the shared passcode to continue.</span>
          </div>
          <form action={submitPasscode} className="flex flex-col gap-3">
            <Input id="passcode" name="passcode" type="password" label="Passcode" placeholder="••••••" required autoFocus />
            {error && <Alert tone="error">Incorrect passcode. Try again.</Alert>}
            <Button type="submit" size="lg" className="w-full">
              Enter
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
