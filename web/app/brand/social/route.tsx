import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const logoUrl = new URL('/official-takeitesee-logo.png', request.url).toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
        }}
      >
        <img
          src={logoUrl}
          alt=""
          width="860"
          height="500"
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
      },
    },
  );
}
