'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Button, Card } from '../ui/primitives';
import { getSupabaseBrowserUser, isSupabaseConfigured, localDevelopmentAuthAdapter, signOutWithSupabase } from '../../services/auth-adapter';
import type { User } from '../../types/auth-domain';

export default function AuthenticatedAccount() {
  const [user, setUser] = useState<User>();

  useEffect(() => {
    const load = async () => {
      if (isSupabaseConfigured()) {
        const current = await getSupabaseBrowserUser();
        if (current) {
          setUser({
            id: current.id,
            name: current.user_metadata?.name ?? current.email ?? 'Account',
            email: current.email ?? '',
            phone: current.user_metadata?.phone,
            role: 'customer',
            createdAt: current.created_at,
            updatedAt: current.updated_at ?? current.created_at,
          });
        }
      } else {
        setUser(localDevelopmentAuthAdapter.getCurrentUser());
      }
    };
    void load();
  }, []);

  if (!user) {
    return (
      <div className="account-page-heading">
        <span className="eyebrow">takeitesee account</span>
        <h1>Your account</h1>
        <p>Sign in to view your development account and bookings.</p>
        <div className="account-actions">
          <Link href="/login" className="button button-primary">Sign in</Link>
          <Link href="/signup" className="button button-secondary">Create account</Link>
        </div>
      </div>
    );
  }

  const signOut = async () => {
    if (isSupabaseConfigured()) await signOutWithSupabase();
    else localDevelopmentAuthAdapter.signOut();
    setUser(undefined);
  };

  return (
    <div className="account-page-heading">
      <span className="eyebrow">takeitesee account</span>
      <h1>Welcome, {user.name.split(' ')[0]}.</h1>
      <p>{isSupabaseConfigured() ? 'Your Supabase account session is active.' : 'Your local development session is active. This session is not production authentication.'}</p>

      <Card className="profile-summary">
        <div className="provider-avatar provider-avatar-large" aria-hidden="true">
          {user.name.split(' ').map((part) => part[0]).join('')}
        </div>
        <div>
          <span className="eyebrow">Signed-in customer</span>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          {user.phone ? <span className="card-location">{user.phone}</span> : null}
        </div>
        <Badge tone="info">{user.role}</Badge>
      </Card>

      <div className="account-actions">
        <Link href="/bookings" className="button button-primary">My bookings</Link>
        <Link href="/notifications" className="button button-secondary">Notifications</Link>
        <Link href="/account/profile" className="button button-secondary">Profile</Link>
        <Link href="/account/settings" className="button button-secondary">Settings</Link>
        <Button type="button" variant="quiet" onClick={signOut}>Sign out</Button>
      </div>

      <Card className="account-provider-entry">
        <span className="eyebrow">Offer services on takeitesee</span>
        <h2>Grow from customer to provider.</h2>
        <p>Create a professional profile for your own services or register a business workspace for a team. This development flow saves a local draft only and does not change live roles or verification.</p>
        <div className="account-actions">
          <Link href="/provider/onboarding?type=professional" className="button button-primary">Become a Professional</Link>
          <Link href="/provider/onboarding?type=business" className="button button-secondary">Register a Business</Link>
          <Link href="/provider" className="button button-quiet">Open provider workspace</Link>
        </div>
      </Card>
    </div>
  );
}
