import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const allowedSizes = new Set([32, 180, 192, 512]);

export async function GET(request: Request, context: { params: Promise<{ size: string }> }) {
  const { size: rawSize } = await context.params;
  const size = Number.parseInt(rawSize, 10);

  if (!allowedSizes.has(size)) {
    return new Response('Not found', { status: 404 });
  }

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
          width={Math.round(size * 0.88)}
          height={Math.round(size * 0.88)}
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
      },
    },
  );
}
