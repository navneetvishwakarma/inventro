'use client';

// S-36a/REQ-26: root-level fallback. Only mounts when the root layout
// itself throws (a genuinely catastrophic failure, not a page-level one --
// app/error.tsx handles those). Must render its own complete <html>/<body>
// since it replaces the root layout entirely on this path; deliberately
// plain inline styles rather than the Card/Button primitives or Tailwind
// classes, since the layout that would normally load fonts/globals.css
// never rendered on this path.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: '#ffffff',
          color: '#171717',
          padding: '1.5rem',
        }}
      >
        <main style={{ maxWidth: 360, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Inventro hit a problem</h1>
          <p style={{ color: '#6b6b6b', fontSize: '0.9rem', lineHeight: 1.4 }}>
            Something went wrong loading the app. Your data is untouched.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '0.5rem',
              border: '1px solid #6b6b6b',
              background: 'transparent',
              color: '#171717',
              padding: '0.5rem 1rem',
              borderRadius: 8,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
