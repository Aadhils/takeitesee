'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Button, Card, Input } from '../ui/primitives';
import { isSupabaseConfigured, localDevelopmentAuthAdapter, signInWithSupabase, signUpWithSupabase } from '../../services/auth-adapter';

function safeReturnTo(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/account';
}

export function LoginForm({ returnTo }: { returnTo: string | null }) {
  const [email, setEmail] = useState('');
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      if (isSupabaseConfigured()) await signInWithSupabase({ email, credential });
      else localDevelopmentAuthAdapter.signIn({ email, credential });
      window.location.assign(safeReturnTo(returnTo));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in.');
      setSubmitting(false);
    }
  };
  return <div className="auth-page"><section className="page-intro"><span className="eyebrow">TakeItSee account</span><h1>Welcome back.</h1><p>Sign in to continue your booking and access your account.</p></section><Card className="auth-card"><span className="badge badge-info">{isSupabaseConfigured() ? 'Supabase authentication' : 'Local development access'}</span><form onSubmit={submit}><Input label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /><Input label={isSupabaseConfigured() ? 'Password' : 'Development credential'} type="password" autoComplete="current-password" hint={isSupabaseConfigured() ? 'Managed securely by Supabase Auth.' : 'This local-only credential is never stored as plaintext.'} required value={credential} onChange={(event) => setCredential(event.target.value)} />{error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="submit" loading={submitting}>Sign in</Button></form><p className="auth-switch">New to TakeItSee? <Link href={`/signup${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-link">Create an account</Link></p></Card></div>;
}

export function SignupForm({ returnTo }: { returnTo: string | null }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', credential: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      if (isSupabaseConfigured()) await signUpWithSupabase(form);
      else localDevelopmentAuthAdapter.signUp(form);
      window.location.assign(safeReturnTo(returnTo));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create an account.');
      setSubmitting(false);
    }
  };
  return <div className="auth-page"><section className="page-intro"><span className="eyebrow">TakeItSee account</span><h1>Create your account.</h1><p>Use a {isSupabaseConfigured() ? 'Supabase' : 'local development'} account to continue your customer booking flow.</p></section><Card className="auth-card"><span className="badge badge-info">{isSupabaseConfigured() ? 'Supabase authentication' : 'Local development access'}</span><form onSubmit={submit}><Input label="Name" autoComplete="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><Input label="Email" type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><Input label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /><Input label={isSupabaseConfigured() ? 'Password' : 'Development credential'} type="password" autoComplete="new-password" hint={isSupabaseConfigured() ? 'Managed securely by Supabase Auth.' : 'Use four or more characters. It is not stored.'} required value={form.credential} onChange={(event) => setForm({ ...form, credential: event.target.value })} />{error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="submit" loading={submitting}>Create account</Button></form><p className="auth-switch">Already registered? <Link href={`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`} className="text-link">Sign in</Link></p></Card></div>;
}
