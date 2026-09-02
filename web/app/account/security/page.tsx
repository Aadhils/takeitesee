'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Card, Input } from '../../../components/ui/primitives';
import { useOperationalTranslations } from '../../../components/i18n/OperationalTranslations';
import {
  getSupabaseBrowserUser,
  isSupabaseConfigured,
  signInWithSupabase,
  updatePasswordWithSupabase,
} from '../../../services/auth-adapter';

export default function AccountSecurityPage() {
  const { locale } = useOperationalTranslations();
  const tamil = locale === 'ta-IN';
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!isSupabaseConfigured()) return;
        const user = await getSupabaseBrowserUser();
        if (active) setEmail(user?.email ?? null);
      } catch {
        if (active) setEmail(null);
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !email) return;
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError(tamil ? 'புதிய password குறைந்தது 8 characters இருக்க வேண்டும்.' : 'Your new password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(tamil ? 'புதிய passwords இரண்டும் பொருந்தவில்லை.' : 'The new passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setError(tamil ? 'தற்போதைய password-இலிருந்து வேறுபட்ட புதிய password பயன்படுத்தவும்.' : 'Choose a new password that is different from your current password.');
      return;
    }

    try {
      setSubmitting(true);
      try {
        await signInWithSupabase({ email, credential: currentPassword });
      } catch {
        throw new Error(tamil ? 'தற்போதைய password-ஐ verify செய்ய முடியவில்லை.' : 'Your current password could not be verified.');
      }
      await updatePasswordWithSupabase(newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(tamil ? 'உங்கள் password பாதுகாப்பாக update செய்யப்பட்டது.' : 'Your password has been updated securely.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (tamil ? 'Password update செய்ய முடியவில்லை.' : 'Unable to update your password.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return <Card><p>{tamil ? 'உங்கள் account security-ஐ சரிபார்க்கிறது…' : 'Checking your account security…'}</p></Card>;
  }

  if (!email) {
    return <main className="container section-stack">
      <Card>
        <h1>{tamil ? 'Account Security-க்கு sign in செய்யவும்' : 'Sign in to manage account security'}</h1>
        <p>{tamil ? 'Password மாற்ற உங்கள் TakeItEsee account-ல் sign in செய்யவும்.' : 'Sign in to your TakeItEsee account to change your password.'}</p>
        <div className="button-row">
          <Link href="/login?returnTo=%2Faccount%2Fsecurity" className="button button-primary">Sign in</Link>
          <Link href="/forgot-password" className="button button-secondary">{tamil ? 'Password மறந்துவிட்டதா?' : 'Forgot password?'}</Link>
        </div>
      </Card>
    </main>;
  }

  return <main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow">{tamil ? 'Account security' : 'Account security'}</span>
      <h1>{tamil ? 'உங்கள் password-ஐ மாற்றவும்' : 'Change your password'}</h1>
      <p>{tamil ? 'மாற்றத்தை அனுமதிக்கும் முன் உங்கள் தற்போதைய password மீண்டும் verify செய்யப்படும்.' : 'Your current password is re-verified before the change is allowed.'}</p>
    </section>

    <Card className="auth-card">
      <div className="settings-note">
        <strong>{tamil ? 'Signed-in email' : 'Signed-in email'}</strong>
        <p>{email}</p>
      </div>
      <form onSubmit={submit} className="section-stack">
        <Input label={tamil ? 'தற்போதைய password' : 'Current password'} type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        <Input label={tamil ? 'புதிய password' : 'New password'} type="password" autoComplete="new-password" required minLength={8} hint={tamil ? 'குறைந்தது 8 characters.' : 'Use at least 8 characters.'} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        <Input label={tamil ? 'புதிய password-ஐ உறுதிப்படுத்தவும்' : 'Confirm new password'} type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        {success ? <div className="alert alert-success" role="status"><strong>{success}</strong></div> : null}
        <div className="button-row">
          <Button type="submit" loading={submitting}>{tamil ? 'Password update செய்' : 'Update password'}</Button>
          <Link href="/account/settings" className="button button-secondary">{tamil ? 'Settings-க்கு திரும்பவும்' : 'Back to settings'}</Link>
        </div>
      </form>
      <p className="settings-note">{tamil ? 'தற்போதைய password நினைவில் இல்லையெனில் secure recovery email flow-ஐ பயன்படுத்தவும்.' : 'If you do not remember your current password, use the secure recovery email flow instead.'} <Link href="/forgot-password" className="text-link">{tamil ? 'Password reset' : 'Reset password'}</Link></p>
    </Card>
  </main>;
}
