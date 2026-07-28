import { submitPasscode } from './actions';

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main style={{ maxWidth: 320, margin: '20vh auto', textAlign: 'center' }}>
      <form action={submitPasscode}>
        <label htmlFor="passcode">Passcode</label>
        <input id="passcode" name="passcode" type="password" required autoFocus />
        <button type="submit">Enter</button>
      </form>
      {error && <p role="alert">Incorrect passcode.</p>}
    </main>
  );
}
