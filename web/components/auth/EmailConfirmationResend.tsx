'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button, Input } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';
import { createSupabaseBrowserClient } from '../../lib/supabase/browser';
import { isSupabaseConfigured } from '../../services/auth-adapter';

const copy = {
  'en-IN': {
    title: 'Need a fresh confirmation email?',
    body: 'Enter the email you used to sign up. For privacy, the result does not reveal whether an account exists for that address.',
    email: 'Signup email',
    action: 'Resend confirmation email',
    cooldown: (seconds: number) => `You can request another email in ${seconds}s.`,
    success: 'If this address has an unconfirmed TakeItEsee account, a fresh confirmation email has been requested. Check your inbox and spam folder.',
    failure: 'We could not request another confirmation email right now. Try again shortly, then contact Platform support if the problem continues.',
  },
  'ta-IN': {
    title: 'புதிய confirmation email வேண்டுமா?',
    body: 'Signup செய்ய பயன்படுத்திய email-ஐ உள்ளிடவும். Privacy காரணமாக அந்த email-க்கு account உள்ளதா என்பதை result வெளிப்படுத்தாது.',
    email: 'Signup email',
    action: 'Confirmation email மீண்டும் அனுப்பு',
    cooldown: (seconds: number) => `${seconds}s கழித்து மீண்டும் email request செய்யலாம்.`,
    success: 'இந்த email-க்கு unconfirmed TakeItEsee account இருந்தால் புதிய confirmation email request செய்யப்பட்டுள்ளது. Inbox மற்றும் spam folder-ஐ பார்க்கவும்.',
    failure: 'இப்போது confirmation email request செய்ய முடியவில்லை. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்; தொடர்ந்து பிரச்சனை இருந்தால் Platform support-ஐ தொடர்பு கொள்ளவும்.',
  },
} as const;

export function EmailConfirmationResend({ initialEmail = '' }: { initialEmail?: string }) {
  const { locale } = useLanguage();
  const localized = copy[locale];
  const [email, setEmail] = useState(initialEmail.trim().toLowerCase());
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending || cooldown > 0) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    setSending(true);
    setSuccess('');
    setError('');

    try {
      if (!isSupabaseConfigured()) throw new Error('Supabase Auth is unavailable.');
      const supabase = createSupabaseBrowserClient();
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
      });
      if (resendError) throw resendError;

      setSuccess(localized.success);
      setCooldown(60);
    } catch {
      setError(localized.failure);
      setCooldown(30);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="section-stack" aria-labelledby="confirmation-resend-heading">
      <div>
        <h3 id="confirmation-resend-heading">{localized.title}</h3>
        <p>{localized.body}</p>
      </div>
      <form onSubmit={submit} className="section-stack">
        <Input
          label={localized.email}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {success ? <div className="alert alert-success" role="status"><strong>{success}</strong></div> : null}
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        {cooldown > 0 ? <p className="settings-note" aria-live="polite">{localized.cooldown(cooldown)}</p> : null}
        <Button type="submit" loading={sending} disabled={sending || cooldown > 0}>{localized.action}</Button>
      </form>
    </section>
  );
}
