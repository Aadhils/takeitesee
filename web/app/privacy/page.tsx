import type { Metadata } from 'next';
import styles from './privacy.module.css';

const description = 'Read the TakeItEsee Privacy Policy, including how personal information is collected, used, stored, shared, protected and how to contact the Grievance Officer.';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description,
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Privacy Policy | TakeItEsee',
    description,
    url: '/privacy',
    type: 'website',
    images: [{ url: '/brand/social', width: 1200, height: 630, alt: 'TakeItEsee' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy | TakeItEsee',
    description,
    images: ['/brand/social'],
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <span className="eyebrow">Legal</span>
        <h1>Privacy Policy</h1>
        <p>How TakeItEsee collects, uses, stores, shares and protects personal information.</p>
        <div className={styles.dates}>
          <span><strong>Effective date:</strong> 2 September 2026</span>
          <span><strong>Last updated:</strong> 2 September 2026</span>
        </div>
      </header>

      <article className={`card ${styles.policy}`}>
        <section id="who-we-are">
          <h2>1. Who we are</h2>
          <p>TakeItEsee is operated by <strong>UV MART Enterprises Private Limited</strong>, having its business address at <strong>15/3 Green House Apart, McDonalds Road, Cantonment, Trichy - 620001, Tamil Nadu, India</strong>. This Privacy Policy explains how TakeItEsee collects, uses, stores, shares and protects personal information when you access or use takeitesee.com and related TakeItEsee services.</p>
        </section>

        <section id="information-we-collect">
          <h2>2. Information we collect</h2>
          <p>Depending on how you use TakeItEsee, we may collect your name, email address, phone number, account identifiers and authentication information. We may also collect profile information such as your location, preferred language, service regions, notification preferences, accessibility preferences and recommendation settings.</p>
          <p>When you use marketplace features, we may process information relating to bookings, service requests, provider or business profiles, messages, reviews, support requests, account activity and other information that you voluntarily submit through the platform.</p>
          <p>Professionals and businesses applying for verification may provide additional information such as legal name, contact phone number, address, verification evidence, supporting notes and verification documents. Verification documents are intended to be handled through restricted, private access mechanisms.</p>
          <p>TakeItEsee may also process technical and security information generated when the service is used, including authentication events, security-relevant events, operational logs and information reasonably necessary to detect abuse, maintain platform security and troubleshoot technical problems.</p>
        </section>

        <section id="how-we-use-information">
          <h2>3. How we use personal information</h2>
          <p>We use personal information to create and manage accounts; authenticate users; maintain customer, professional and business profiles; enable service discovery and marketplace interactions; manage bookings and related communications; support provider verification and platform trust; provide customer support; send service-related emails and notifications; remember user preferences; personalise eligible service recommendations where the user has enabled that preference; prevent abuse, fraud and unauthorised activity; maintain audit and security records; comply with applicable laws; and improve the reliability and operation of TakeItEsee.</p>
          <p>Where applicable law requires consent, we will seek consent before processing information for the relevant purpose. Where legally permitted, information may also be processed when necessary to provide a service requested by you, protect the platform and its users, comply with legal obligations, or for other lawful purposes recognised under applicable law.</p>
        </section>

        <section id="cookies-browser-storage">
          <h2>4. Cookies and browser storage</h2>
          <p>TakeItEsee uses first-party technologies necessary for authentication, security, preferences and normal platform operation. For example, authentication may rely on secure session cookies, and your selected language may be stored using a first-party cookie and browser local storage.</p>
          <p>TakeItEsee may also keep limited browser-local information such as recently viewed service identifiers to improve navigation and presentation. This type of local history remains on the browser unless removed by the user or browser.</p>
          <p>At the date of this Policy, TakeItEsee does <strong>not intentionally use third-party advertising cookies or advertising tracking pixels</strong>. If analytics or advertising technologies are introduced in the future, this Policy and the Cookie Policy will be updated as required.</p>
        </section>

        <section id="sharing-information">
          <h2>5. How we share information</h2>
          <p>We do not sell personal information.</p>
          <p>We may share or make information available only where reasonably necessary to operate TakeItEsee, including with infrastructure and technology providers that assist with hosting, authentication, databases, storage, security and transactional email delivery. Current infrastructure may include service providers such as <strong>Supabase, Vercel and Resend</strong>, subject to their applicable contractual and security arrangements.</p>
          <p>Marketplace information may also be shared with the relevant customer, professional or business where that sharing is necessary to fulfil a service interaction or marketplace function.</p>
          <p>Information may be disclosed where required by law, lawful government request, court order, regulatory requirement, or when reasonably necessary to protect TakeItEsee, its users, or the public from fraud, security threats, abuse or unlawful conduct.</p>
        </section>

        <section id="provider-verification">
          <h2>6. Provider verification information</h2>
          <p>Provider verification information and supporting documents may contain sensitive or confidential identifying information. TakeItEsee restricts access to such information to the applicant and authorised TakeItEsee personnel where required for verification, trust, moderation, security or lawful operational purposes.</p>
          <p>Verification records may include review history and audit information necessary to preserve platform trust and accountability.</p>
        </section>

        <section id="retention">
          <h2>7. Data retention</h2>
          <p>We retain personal information only for as long as reasonably necessary for the purposes described in this Policy, to provide the service, maintain security and audit integrity, resolve disputes, enforce platform rules and satisfy applicable legal or regulatory obligations.</p>
          <p>Different categories of information may require different retention periods. When information is no longer required, we will take reasonable steps to delete, anonymise or otherwise securely dispose of it, subject to legal, security, fraud-prevention and legitimate record-keeping requirements.</p>
        </section>

        <section id="privacy-requests">
          <h2>8. Your choices and privacy requests</h2>
          <p>You may update available profile details, communication preferences, language preferences and recommendation settings through TakeItEsee where those controls are provided.</p>
          <p>You may also request access to, correction of, or deletion of eligible personal information by contacting the Grievance Officer listed below. Because automated account deletion is not currently available from the account settings interface, deletion requests may require manual review and processing.</p>
          <p>Some information may need to be retained even after a deletion request where retention is required by law or is reasonably necessary for security, fraud prevention, dispute resolution, audit integrity, or protection of legal rights.</p>
          <p>As applicable provisions of India&apos;s Digital Personal Data Protection framework come into force, TakeItEsee will provide and maintain applicable Data Principal rights and request mechanisms required by law.</p>
        </section>

        <section id="security">
          <h2>9. Security</h2>
          <p>TakeItEsee uses reasonable technical and organisational safeguards designed to protect personal information. These may include authenticated access controls, role-based authorisation, database access policies, restricted storage for private documents, secure session management, audit logging and security monitoring.</p>
          <p>No internet service or storage system can guarantee absolute security. Users should protect their account credentials and notify us if they suspect unauthorised account access.</p>
        </section>

        <section id="international-processing">
          <h2>10. International processing</h2>
          <p>Some technology providers supporting TakeItEsee may process or store information using infrastructure located in India or other jurisdictions. Where cross-border processing occurs, TakeItEsee will handle such transfers in accordance with applicable legal requirements and use reasonable contractual, organisational and security safeguards.</p>
        </section>

        <section id="age-requirement">
          <h2>11. Age requirement</h2>
          <p>TakeItEsee accounts and services are intended only for persons who are <strong>18 years of age or older</strong>.</p>
          <p>We do not knowingly permit persons under 18 to create an account or submit personal information through TakeItEsee. If we become aware that information has been submitted by a person under 18 contrary to this requirement, we may take reasonable steps to restrict the account and remove eligible information.</p>
        </section>

        <section id="third-party-links">
          <h2>12. Third-party links</h2>
          <p>TakeItEsee may contain links to external websites or services. Their privacy practices are controlled by those third parties and are not governed by this Privacy Policy. Users should review the privacy policies of external services before providing personal information to them.</p>
        </section>

        <section id="changes">
          <h2>13. Changes to this Privacy Policy</h2>
          <p>We may update this Privacy Policy when TakeItEsee features, technology, service providers or applicable laws change. Material changes will be communicated or displayed through an appropriate platform notice where required.</p>
          <p>The current version and its effective date will be published on TakeItEsee.</p>
        </section>

        <section id="grievance-contact" className={styles.contactSection}>
          <h2>14. Grievance and privacy contact</h2>
          <p>For questions, privacy requests or grievances concerning personal information, contact:</p>
          <address>
            <strong>Grievance Officer:</strong> Aadhil<br />
            <strong>Operator:</strong> UV MART Enterprises Private Limited<br />
            <strong>Email:</strong> <a href="mailto:uandv.com@gmail.com">uandv.com@gmail.com</a><br />
            <strong>Address:</strong> 15/3 Green House Apart, McDonalds Road, Cantonment, Trichy - 620001, Tamil Nadu, India
          </address>
          <p>We will review privacy and grievance requests in accordance with applicable Indian law and within applicable statutory timelines.</p>
        </section>
      </article>
    </div>
  );
}
