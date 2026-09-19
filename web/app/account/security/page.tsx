'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import styles from '../../../components/account/CustomerSecurityPrivacyResponsive.module.css';
import { Button, Card, Input } from '../../../components/ui/primitives';
import { PasswordInput } from '../../../components/ui/PasswordInput';
import { useAccountSecurityTranslations } from '../../../components/i18n/AccountSecurityTranslations';
import {
  getSupabaseBrowserUser,
  isSupabaseConfigured,
  signInWithSupabase,
  updateEmailWithSupabase,
  updatePasswordWithSupabase,
} from '../../../services/auth-adapter';

export default function AccountSecurityPage() {
  const { t } = useAccountSecurityTranslations();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const showLabel = t('security.password.show');
  const hideLabel = t('security.password.hide');

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
      setError(t('security.password.minValidation'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('security.password.mismatchValidation'));
      return;
    }
    if (currentPassword === newPassword) {
      setError(t('security.password.sameValidation'));
      return;
    }

    try {
      setSubmitting(true);
      try {
        await signInWithSupabase({ email, credential: currentPassword });
      } catch {
        throw new Error(t('security.password.verifyFailed'));
      }
      await updatePasswordWithSupabase(newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(t('security.password.updateSuccess'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('security.password.updateFallback'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitEmailChange = async (event: FormEvent) => {
    event.preventDefault();
    if (emailSubmitting || !email) return;
    setEmailError('');
    setEmailSuccess('');
    const normalizedEmail = newEmail.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setEmailError(t('security.email.invalidValidation'));
      return;
    }
    if (normalizedEmail === email.toLowerCase()) {
      setEmailError(t('security.email.sameValidation'));
      return;
    }

    try {
      setEmailSubmitting(true);
      try {
        await signInWithSupabase({ email, credential: emailCurrentPassword });
      } catch {
        throw new Error(t('security.password.verifyFailed'));
      }
      await updateEmailWithSupabase(normalizedEmail);
      setEmailCurrentPassword('');
      setNewEmail('');
      setEmailSuccess(t('security.email.updateSuccess'));
    } catch (cause) {
      setEmailError(cause instanceof Error ? cause.message : t('security.email.updateFallback'));
    } finally {
      setEmailSubmitting(false);
    }
  };

  if (checking) {
    return <div className={styles.securityPrivacyJourney}><Card><p>{t('security.checking')}</p></Card></div>;
  }

  if (!email) {
    return <div className={styles.securityPrivacyJourney}><main className="container section-stack">
      <Card>
        <h1>{t('security.auth.title')}</h1>
        <p>{t('security.auth.body')}</p>
        <div className="button-row">
          <Link href="/login?returnTo=%2Faccount%2Fsecurity" className="button button-primary">{t('security.auth.signIn')}</Link>
          <Link href="/forgot-password" className="button button-secondary">{t('security.auth.forgotPassword')}</Link>
        </div>
      </Card>
    </main></div>;
  }

  return <div className={styles.securityPrivacyJourney}><main className="container section-stack">
    <section className="page-intro">
      <span className="eyebrow">{t('security.eyebrow')}</span>
      <h1>{t('security.title')}</h1>
      <p>{t('security.intro')}</p>
    </section>

    <Card className="auth-card">
      <div className="settings-note">
        <strong>{t('security.signedInEmail')}</strong>
        <p>{email}</p>
      </div>
      <h2>{t('security.password.title')}</h2>
      <form onSubmit={submit} className="section-stack">
        <PasswordInput label={t('security.password.current')} autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} showLabel={showLabel} hideLabel={hideLabel} />
        <PasswordInput label={t('security.password.new')} autoComplete="new-password" required minLength={8} hint={t('security.password.newHint')} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} showLabel={showLabel} hideLabel={hideLabel} />
        <PasswordInput label={t('security.password.confirm')} autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} showLabel={showLabel} hideLabel={hideLabel} />
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        {success ? <div className="alert alert-success" role="status"><strong>{success}</strong></div> : null}
        <div className="button-row">
          <Button type="submit" loading={submitting}>{t('security.password.updateAction')}</Button>
          <Link href="/account/settings" className="button button-secondary">{t('security.password.backSettings')}</Link>
        </div>
      </form>
      <p className="settings-note">{t('security.password.recoveryBody')} <Link href="/forgot-password" className="text-link">{t('security.password.resetAction')}</Link></p>
    </Card>

    <Card className="auth-card">
      <h2>{t('security.email.title')}</h2>
      <p>{t('security.email.body')}</p>
      <form onSubmit={submitEmailChange} className="section-stack">
        <PasswordInput label={t('security.email.currentPassword')} autoComplete="current-password" required value={emailCurrentPassword} onChange={(event) => setEmailCurrentPassword(event.target.value)} showLabel={showLabel} hideLabel={hideLabel} />
        <Input label={t('security.email.new')} type="email" autoComplete="email" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
        {emailError ? <p className="field-error" role="alert">{emailError}</p> : null}
        {emailSuccess ? <div className="alert alert-success" role="status"><strong>{emailSuccess}</strong></div> : null}
        <Button type="submit" loading={emailSubmitting}>{t('security.email.requestAction')}</Button>
      </form>
    </Card>
  </main></div>;
}
