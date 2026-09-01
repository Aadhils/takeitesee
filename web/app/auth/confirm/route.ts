import type { EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

const supportedConfirmationTypes = new Set<EmailOtpType>(['email']);

function privateRedirect(request: NextRequest, pathname: string, confirmation: 'confirmed' | 'failed') {
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = pathname;
  redirectTo.search = '';
  redirectTo.searchParams.set('confirmation', confirmation);

  const response = NextResponse.redirect(redirectTo, 303);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null;

  if (!tokenHash || !type || !supportedConfirmationTypes.has(type)) {
    return privateRedirect(request, '/login', 'failed');
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (error) {
      return privateRedirect(request, '/login', 'failed');
    }

    return privateRedirect(request, '/account', 'confirmed');
  } catch {
    return privateRedirect(request, '/login', 'failed');
  }
}
