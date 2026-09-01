'use client';

export default function GlobalError({
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
          background: '#f8fafc',
          color: '#0f172a',
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <main
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: '32px 20px',
            boxSizing: 'border-box',
          }}
        >
          <section
            style={{
              width: '100%',
              maxWidth: 560,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 20,
              padding: 32,
              boxSizing: 'border-box',
              boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
            }}
          >
            <p
              style={{
                margin: '0 0 10px',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Takeitesee
            </p>
            <h1 style={{ margin: '0 0 12px', fontSize: 32, lineHeight: 1.15 }}>
              Something went wrong
            </h1>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: '#475569' }}>
              Takeitesee couldn&apos;t load this page. Try again, or return home.
            </p>

            <div
              lang="ta"
              style={{
                marginTop: 22,
                paddingTop: 22,
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <h2 style={{ margin: '0 0 10px', fontSize: 22, lineHeight: 1.4 }}>
                எதிர்பாராத சிக்கல் ஏற்பட்டது
              </h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: '#475569' }}>
                இந்தப் பக்கத்தை Takeitesee ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும் அல்லது முகப்புப் பக்கத்திற்குச் செல்லவும்.
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                marginTop: 28,
              }}
            >
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  appearance: 'none',
                  border: 0,
                  borderRadius: 999,
                  padding: '11px 18px',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Try again / மீண்டும் முயற்சி
              </button>
              <a
                href="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: 999,
                  padding: '10px 18px',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 15,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Home / முகப்பு
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
