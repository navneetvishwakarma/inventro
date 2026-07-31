import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// S-36a/REQ-26: styled 404 for any unmatched route, replacing Next's default.
export default function NotFound() {
  return (
    <main style={{ maxWidth: 480, margin: '10vh auto', padding: '0 1rem' }}>
      <Card>
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>There&apos;s nothing here.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/" className="underline">
            Back to Today
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
