import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TakeItEsee',
    short_name: 'TakeItEsee',
    description: 'Find trusted local services, verified professionals, and service businesses on TakeItEsee.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#6352d9',
    icons: [
      {
        src: '/brand/icon/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/icon/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
