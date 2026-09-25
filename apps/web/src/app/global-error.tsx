'use client';

/**
 * Last line of defence: replaces the root layout when even that fails to render. Styled
 * inline because the global stylesheet may not have loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#15120f',
          color: '#f3ebdd',
          fontFamily: 'system-ui, sans-serif',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: 28, margin: '0 0 12px' }}>Flare could not start.</h1>
          <p style={{ color: '#c9bfb0', lineHeight: 1.5, margin: '0 0 20px' }}>
            Reload the page. If this keeps happening, the error reference is{' '}
            <code>{error.digest ?? error.name}</code>.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#f0a35b',
              color: '#15120f',
              border: 0,
              borderRadius: 10,
              padding: '10px 18px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
