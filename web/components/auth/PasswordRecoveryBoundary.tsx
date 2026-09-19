'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '../ui/primitives';
import { usePasswordRecoveryTranslations } from '../i18n/PasswordRecoveryTranslations';
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
  const { t } = usePasswordRecoveryTranslations();
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
        <span className="eyebrow">{t('recovery.eyebrow')}</span>
        <h1>{t('recovery.checking.title')}</h1>
        <p>{t('recovery.checking.body')}</p>
      </section>
      <Card><p>{t('recovery.checking.session')}</p></Card>
    </div>;
  }

  return <div className="auth-page">
    <section className="page-intro">
      <span className="eyebrow">{t('recovery.eyebrow')}</span>
      <h1>{t('recovery.invalid.title')}</h1>
      <p>{t('recovery.invalid.body')}</p>
    </section>
    <Card className="auth-card">
      <p>{t('recovery.invalid.sessionBoundary')}</p>
      <Link href="/forgot-password" className="button button-primary">{t('recovery.invalid.requestAnother')}</Link>
      <p className="auth-switch"><Link href="/login" className="text-link">{t('recovery.invalid.backToSignIn')}</Link></p>
    </Card>
  </div>;
}
