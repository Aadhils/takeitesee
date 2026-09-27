import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Delete your TakeItEsee account',
  description: 'Request deletion of your TakeItEsee account and associated eligible personal data.',
  alternates: { canonical: '/account-deletion' },
  robots: { index: true, follow: true },
};

export default function AccountDeletionPage() {
  return (
    <main className="page-shell">
      <section className="page-intro">
        <span className="eyebrow">Privacy control</span>
        <h1>Delete your TakeItEsee account</h1>
        <p>
          TakeItEsee, operated by UV MART Enterprises Private Limited, lets you request deletion of your account
          and associated eligible personal data from the web. You do not need the TakeItEsee mobile app installed.
        </p>
      </section>

      <section className="card section-stack">
        <div>
          <h2>Verify your account and submit the request</h2>
          <p>
            Sign in with the TakeItEsee account you want deleted. This verifies that another person cannot request
            deletion of your account using only your email address.
          </p>
        </div>
        <div className="button-row">
          <Link className="button button-primary" href="/login?returnTo=%2Faccount%2Fprivacy">
            Sign in to request account deletion
          </Link>
          <Link className="button button-secondary" href="/privacy#privacy-requests">
            Read deletion and retention policy
          </Link>
        </div>
        <div className="settings-note">
          <strong>What happens next?</strong>
          <p>
            After sign-in, choose <strong>Deletion</strong> in the Privacy Requests page and submit the request.
            TakeItEsee reviews deletion requests before processing them. Eligible account data is deleted; limited
            records may be retained where required for security, fraud prevention, disputes, audit integrity, or
            legal obligations as described in the Privacy Policy.
          </p>
        </div>
      </section>

      <section className="card section-stack">
        <h2>Cannot sign in?</h2>
        <p>
          Use the privacy contact in the Privacy Policy for help verifying your identity and initiating the request.
          Never send your password or other account secret by email.
        </p>
        <Link className="text-link" href="/privacy#grievance-contact">Open privacy contact details →</Link>
      </section>
    </main>
  );
}
