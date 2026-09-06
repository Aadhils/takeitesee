import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROVIDER_RETURN_TO_HEADER = 'x-takeitesee-provider-return-to';
const ADMIN_RETURN_TO_HEADER = 'x-takeitesee-admin-return-to';
const SUPER_ADMIN_RETURN_TO_HEADER = 'x-takeitesee-super-admin-return-to';

function upstreamRequestHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;
  const returnTo = `${pathname}${request.nextUrl.search}`;

  headers.delete(PROVIDER_RETURN_TO_HEADER);
  headers.delete(ADMIN_RETURN_TO_HEADER);
  headers.delete(SUPER_ADMIN_RETURN_TO_HEADER);

  if (pathname === '/provider' || pathname.startsWith('/provider/')) {
    headers.set(PROVIDER_RETURN_TO_HEADER, returnTo);
  } else if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    headers.set(ADMIN_RETURN_TO_HEADER, returnTo);
  } else if (pathname === '/super-admin' || pathname.startsWith('/super-admin/')) {
    headers.set(SUPER_ADMIN_RETURN_TO_HEADER, returnTo);
  }
  return headers;
}

function nextResponse(request: NextRequest) {
  return NextResponse.next({ request: { headers: upstreamRequestHeaders(request) } });
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.hostname.toLowerCase() === 'testing.takeitesee.com') {
    const productionUrl = request.nextUrl.clone();
    productionUrl.protocol = 'https:';
    productionUrl.hostname = 'takeitesee.com';
    productionUrl.port = '';
    return NextResponse.redirect(productionUrl, 308);
  }

  let response = nextResponse(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = nextResponse(request);
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
