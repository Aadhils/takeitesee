'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';
import { isSupabaseConfigured } from '../../services/auth-adapter';
import { ResetPasswordForm } from './AuthForms';

type RecoveryGateState = 'checking' | 'authorized' | 'invalid';

function hasRecoveryCallbackHint() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return query.get('type') === 'recovery'
    || hash.get('type') === 'recovery'
    || query.has('code');
}

export function PasswordRecoveryBoundary() {
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
  const [state, setState] = useState<RecoveryGateState>('checking');

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState('invalid');
      return;
    }

    const callbackHint = hasRecoveryCallbackHint();
    const supabase = createSupabaseBrowserClient();
    let active = true;
    let recoveryObserved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        recoveryObserved = true;
        setState('authorized');
        return;
      }
      if (event === 'INITIAL_SESSION' && !callbackHint) {
        setState('invalid');
      }
    });

    const timeout = window.setTimeout(() => {
      if (active && !recoveryObserved) setState('invalid');
    }, callbackHint ? 15000 : 1500);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  if (state === 'authorized') return <ResetPasswordForm />;

  if (state === 'checking') {
    return <div className="auth-page">
      <section className="page-intro">
        <span className="eyebrow">{tamil ? 'பாதுகாப்பான password reset' : 'Secure password reset'}</span>
        <h1>{tamil ? 'Recovery link-ஐ சரிபார்க்கிறது…' : 'Checking your recovery link…'}</h1>
        <p>{tamil ? 'இந்த password reset request Supabase recovery session-இலிருந்து வந்ததா என்பதை சரிபார்க்கிறது.' : 'Checking that this password reset came from a valid Supabase recovery session.'}</p>
      </section>
      <Card><p>{tamil ? 'Recovery session-ஐ சரிபார்க்கிறது…' : 'Checking recovery session…'}</p></Card>
    </div>;
  }

  return <div className="auth-page">
    <section className="page-intro">
      <span className="eyebrow">{tamil ? 'பாதுகாப்பான password reset' : 'Secure password reset'}</span>
      <h1>{tamil ? 'இந்த recovery link active இல்லை.' : 'This recovery link is not active.'}</h1>
      <p>{tamil ? 'புதிய password-reset email request செய்து அதில் வரும் சமீபத்திய recovery link-ஐ திறக்கவும்.' : 'Request a new password-reset email and open the latest recovery link.'}</p>
    </section>
    <Card className="auth-card">
      <p>{tamil ? 'சாதாரண signed-in session மட்டும் password recovery form-ஐ திறக்காது.' : 'A normal signed-in session does not unlock the password recovery form.'}</p>
      <Link href="/forgot-password" className="button button-primary">{tamil ? 'புதிய reset email request செய்' : 'Request another reset email'}</Link>
      <p className="auth-switch"><Link href="/login" className="text-link">{tamil ? 'Sign in-க்கு திரும்பவும்' : 'Back to sign in'}</Link></p>
    </Card>
  </div>;
}
