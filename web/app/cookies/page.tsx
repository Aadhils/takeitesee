import type { Metadata } from 'next';
import styles from './cookies.module.css';

const description = 'Read the TakeItEsee Cookie Policy, including how authentication cookies, language preferences, browser storage and similar technologies are used.';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description,
  alternates: { canonical: '/cookies' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Cookie Policy | TakeItEsee',
    description,
    url: '/cookies',
    type: 'website',
    images: [{ url: '/brand/social', width: 1200, height: 630, alt: 'TakeItEsee' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cookie Policy | TakeItEsee',
    description,
    images: ['/brand/social'],
  },
};

export default function CookiePolicyPage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <span className="eyebrow">Legal</span>
        <h1>Cookie Policy</h1>
        <p>How TakeItEsee uses cookies, local storage and similar browser technologies.</p>
        <div className={styles.dates}>
          <span><strong>Effective date:</strong> 2 September 2026</span>
          <span><strong>Last updated:</strong> 2 September 2026</span>
        </div>
      </header>

      <article className={`card ${styles.policy}`}>
        <section id="about-this-policy">
          <h2>1. About this Cookie Policy</h2>
          <p>This Cookie Policy explains how <strong>TakeItEsee</strong> uses cookies, local storage and similar browser technologies when you visit or use takeitesee.com and related marketplace services.</p>
          <p>TakeItEsee is operated by:</p>
          <address>
            <strong>UV MART Enterprises Private Limited</strong><br />
            15/3 Green House Apart,<br />
            McDonalds Road, Cantonment,<br />
            Trichy - 620001, Tamil Nadu, India.
          </address>
          <p>This Cookie Policy should be read together with the TakeItEsee <a href="/privacy"><strong>Privacy Policy</strong></a> and <a href="/terms"><strong>Terms of Service</strong></a>.</p>
        </section>

        <section id="what-cookies-storage-are">
          <h2>2. What cookies and browser storage are</h2>
          <p>Cookies are small pieces of information that a website can store through your browser and receive again on later requests or visits.</p>
          <p>Browser local storage is another browser feature that allows limited information to be retained on your device without sending that information automatically with every web request.</p>
          <p>TakeItEsee uses these technologies only for the purposes described in this Policy.</p>
        </section>

        <section id="authentication-security">
          <h2>3. Essential authentication and security cookies</h2>
          <p>TakeItEsee uses authentication technology provided through its production authentication infrastructure to maintain secure signed-in sessions and support account-related functions.</p>
          <p>These cookies may be used to maintain your authenticated session, identify whether you are signed in, refresh or validate a session, support account security, and complete authentication-related actions such as sign-in, email confirmation, password recovery and sign-out.</p>
          <p>These cookies are necessary for authenticated TakeItEsee features to function correctly.</p>
          <p>The exact cookie names and technical duration may be determined by the authentication service and can change as the underlying security implementation evolves.</p>
          <p>TakeItEsee does not use authentication cookies for advertising.</p>
        </section>

        <section id="language-preference">
          <h2>4. Language preference</h2>
          <p>When you choose a supported language on TakeItEsee, the platform may store your language preference so that your selected language can be restored on later visits.</p>
          <p>The current preference identifier is <strong>takeitesee_locale</strong>.</p>
          <p>The preference may be stored both as a first-party cookie and in browser local storage.</p>
          <p>The current first-party language cookie is configured with a maximum lifetime of approximately <strong>one year</strong>, applies across the TakeItEsee site and uses <strong>SameSite=Lax</strong>.</p>
          <p>The language preference does not contain your password, payment information or provider-verification documents.</p>
        </section>

        <section id="recently-viewed">
          <h2>5. Recently viewed services</h2>
          <p>TakeItEsee may use browser local storage to remember a limited list of service pages recently viewed on your device.</p>
          <p>The current local-storage identifier is <strong>takeitesee.recentlyViewed</strong>.</p>
          <p>It stores only a limited list of service identifiers and is currently capped at the six most recently viewed services.</p>
          <p>This information is used as local presentation state to improve navigation and does not by itself create a public activity history.</p>
        </section>

        <section id="local-storage">
          <h2>6. Local storage is not always a cookie</h2>
          <p>Some functionality described in this Policy uses browser local storage rather than HTTP cookies.</p>
          <p>Deleting cookies alone may therefore not remove every stored preference. Your browser may provide separate controls for clearing cookies, site data and local storage.</p>
          <p>TakeItEsee currently uses local storage for the language preference and limited recently viewed service identifiers.</p>
        </section>

        <section id="analytics-advertising">
          <h2>7. Analytics and advertising technologies</h2>
          <p>As of the effective date of this Policy, TakeItEsee does <strong>not intentionally deploy third-party advertising cookies, advertising tracking pixels or third-party behavioral analytics trackers</strong> for profiling users across unrelated websites.</p>
          <p>The current production-code audit found no configured Google Analytics, Google Tag Manager, Meta Pixel, Hotjar, Plausible, PostHog or Microsoft Clarity tracking integration.</p>
          <p>If TakeItEsee later introduces analytics, advertising or similar tracking technologies that materially change how browser information is processed, this Cookie Policy and related notices or controls will be updated as appropriate.</p>
        </section>

        <section id="third-party-infrastructure">
          <h2>8. Third-party infrastructure</h2>
          <p>TakeItEsee relies on technology and infrastructure providers to operate the platform.</p>
          <p>For example, authentication and session management may involve <strong>Supabase</strong>, while the web application may be hosted or delivered using infrastructure such as <strong>Vercel</strong>.</p>
          <p>A technology provider may process technical information necessary to deliver its service in accordance with its applicable contractual, privacy and security arrangements.</p>
          <p>The inclusion of an infrastructure provider does not mean TakeItEsee permits that provider to use TakeItEsee authentication information for independent advertising purposes.</p>
        </section>

        <section id="development-storage">
          <h2>9. Development-only browser storage</h2>
          <p>TakeItEsee&apos;s software may contain browser-storage mechanisms used only as development or fallback tooling when the production Supabase environment is not configured.</p>
          <p>Those development mechanisms are not intended to describe the normal production account or booking storage model on takeitesee.com.</p>
          <p>Production account authentication uses the configured Supabase authentication flow, and production booking operations use the configured server-backed marketplace flow rather than the local development repository.</p>
        </section>

        <section id="controls">
          <h2>10. How you can control cookies and local storage</h2>
          <p>You can normally use your browser settings to view, block or delete cookies and other stored site data.</p>
          <p>Blocking or deleting essential authentication cookies may sign you out or prevent account-based TakeItEsee features from working correctly.</p>
          <p>Removing the TakeItEsee language preference may cause the platform to return to its default language until you choose a language again.</p>
          <p>Clearing local storage may also remove locally retained recently viewed service information.</p>
          <p>Browser controls differ between browsers and devices, so the available steps depend on the browser you use.</p>
        </section>

        <section id="consent-choices">
          <h2>11. Consent and choices</h2>
          <p>Where applicable law requires consent or another user choice before a particular non-essential technology is used, TakeItEsee will provide an appropriate mechanism before using that technology.</p>
          <p>TakeItEsee will not treat this Cookie Policy by itself as consent where applicable law requires a separate affirmative action.</p>
          <p>India&apos;s Digital Personal Data Protection framework requires consent, where relied upon, to be free, specific, informed, unconditional and unambiguous. Applicable requirements and commencement timelines will be followed as they take effect.</p>
        </section>

        <section id="privacy-rights">
          <h2>12. Personal information and privacy rights</h2>
          <p>Information processed through cookies or browser technologies may constitute personal data where it relates to or can identify an individual.</p>
          <p>How TakeItEsee handles personal information, including applicable purposes, disclosures, retention, security and privacy requests, is explained in the <a href="/privacy"><strong>TakeItEsee Privacy Policy</strong></a>.</p>
          <p>Users should refer to that Policy for broader information about personal-data processing and available privacy rights.</p>
        </section>

        <section id="retention">
          <h2>13. Retention</h2>
          <p>Different browser technologies remain available for different periods.</p>
          <p>The current TakeItEsee language cookie has a maximum lifetime of approximately one year unless it is replaced or deleted earlier.</p>
          <p>Authentication-cookie duration depends on the applicable authenticated session and security configuration.</p>
          <p>Browser local-storage information generally remains on the device until it is replaced, cleared by application behavior, removed by the user, or deleted by browser or device controls.</p>
          <p>TakeItEsee will not intentionally retain browser-derived personal information for longer than reasonably necessary for the purpose for which it is processed, subject to applicable legal, security and operational requirements.</p>
        </section>

        <section id="security">
          <h2>14. Security</h2>
          <p>TakeItEsee applies reasonable technical and organisational measures intended to protect marketplace and account information.</p>
          <p>You should not share authentication credentials with another person and should sign out of shared or public devices when you have finished using TakeItEsee.</p>
          <p>Browser-storage controls and device security remain partly under the control of the user and the browser or device provider.</p>
        </section>

        <section id="changes">
          <h2>15. Changes to this Cookie Policy</h2>
          <p>TakeItEsee may update this Cookie Policy when browser technologies, platform functionality, service providers or applicable legal requirements change.</p>
          <p>If a change materially affects how TakeItEsee uses cookies or similar technologies, an appropriate updated notice or user choice will be provided where required.</p>
          <p>The current version and last-updated date will be published on TakeItEsee.</p>
        </section>

        <section id="contact" className={styles.contactSection}>
          <h2>16. Contact and Grievance Officer</h2>
          <p>Questions or concerns about this Cookie Policy or TakeItEsee&apos;s use of browser technologies may be directed to:</p>
          <address>
            <strong>UV MART Enterprises Private Limited</strong><br />
            15/3 Green House Apart,<br />
            McDonalds Road, Cantonment,<br />
            Trichy - 620001, Tamil Nadu, India.<br /><br />
            <strong>Grievance Officer:</strong> Aadhil<br />
            <strong>Email:</strong> <a href="mailto:uandv.com@gmail.com">uandv.com@gmail.com</a>
          </address>
        </section>
      </article>
    </div>
  );
}
