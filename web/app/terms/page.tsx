import type { Metadata } from 'next';
import styles from './terms.module.css';

const description = 'Read the TakeItEsee Terms of Service governing accounts, customers, professionals, businesses, listings, bookings, reviews, moderation, grievances and marketplace use.';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description,
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Terms of Service | TakeItEsee',
    description,
    url: '/terms',
    type: 'website',
    images: [{ url: '/brand/social', width: 1200, height: 630, alt: 'TakeItEsee' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service | TakeItEsee',
    description,
    images: ['/brand/social'],
  },
};

export default function TermsOfServicePage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <span className="eyebrow">Legal</span>
        <h1>Terms of Service</h1>
        <p>The rules that govern access to and use of the TakeItEsee marketplace.</p>
        <div className={styles.dates}>
          <span><strong>Effective date:</strong> 2 September 2026</span>
          <span><strong>Last updated:</strong> 2 September 2026</span>
        </div>
      </header>

      <article className={`card ${styles.policy}`}>
        <section id="about-these-terms">
          <h2>1. About these Terms</h2>
          <p>These Terms of Service (“Terms”) govern your access to and use of <strong>TakeItEsee</strong>, including takeitesee.com and related marketplace services.</p>
          <p>TakeItEsee is operated by:</p>
          <address>
            <strong>UV MART Enterprises Private Limited</strong><br />
            15/3 Green House Apart,<br />
            McDonalds Road, Cantonment,<br />
            Trichy - 620001, Tamil Nadu, India.
          </address>
          <p>By creating an account, accessing the marketplace, posting a requirement, listing or providing a service, making or accepting a booking, sending marketplace communications, or otherwise using TakeItEsee, you agree to these Terms and our Privacy Policy.</p>
          <p>If you do not agree to these Terms, you should not use TakeItEsee.</p>
        </section>

        <section id="eligibility">
          <h2>2. Eligibility</h2>
          <p>TakeItEsee accounts and services are intended only for persons who are <strong>18 years of age or older</strong>.</p>
          <p>By creating an account or using account-based features, you confirm that you are at least 18 years old and legally capable of entering into binding arrangements under applicable law.</p>
          <p>Businesses and professionals using TakeItEsee must also have the authority and any licences, registrations, permissions or qualifications required to provide the services they offer.</p>
        </section>

        <section id="what-takeitesee-does">
          <h2>3. What TakeItEsee does</h2>
          <p>TakeItEsee operates a technology-enabled marketplace that helps customers discover and interact with independent professionals and service businesses.</p>
          <p>The platform may provide features for service discovery, provider profiles, requirements, bookings, schedules, messaging, reviews, provider verification, support, moderation and related marketplace functions.</p>
          <p>Unless TakeItEsee expressly states otherwise for a particular service, the professional or business providing a service is responsible for performing that service.</p>
          <p>TakeItEsee remains responsible for its own obligations as a marketplace platform under applicable law. Nothing in these Terms is intended to remove or restrict rights or remedies that cannot legally be excluded.</p>
        </section>

        <section id="user-accounts">
          <h2>4. User accounts</h2>
          <p>You must provide accurate and reasonably current information when creating or maintaining an account.</p>
          <p>You are responsible for safeguarding your account credentials and for activity carried out through your account, except where applicable law provides otherwise.</p>
          <p>You must not:</p>
          <ul>
            <li>impersonate another person or organisation;</li>
            <li>create accounts using materially false information;</li>
            <li>share or misuse another person&apos;s account or credentials;</li>
            <li>attempt to bypass authentication or access controls; or</li>
            <li>use TakeItEsee for fraudulent, unlawful or abusive activity.</li>
          </ul>
          <p>If you believe your account has been compromised, you should contact TakeItEsee promptly.</p>
        </section>

        <section id="customer-responsibilities">
          <h2>5. Customer responsibilities</h2>
          <p>Customers are responsible for providing accurate information reasonably required for a service request or booking.</p>
          <p>Customers should review the provider profile, service description, scope, location, availability, pricing information and any booking-specific terms shown before confirming a service.</p>
          <p>Customers must communicate respectfully and must not use the marketplace to request unlawful services, commit fraud, harass providers or other users, or misuse marketplace features.</p>
        </section>

        <section id="providers">
          <h2>6. Professionals and businesses</h2>
          <p>Professionals and businesses are responsible for the accuracy, legality and completeness of the services they list.</p>
          <p>A provider must:</p>
          <ul>
            <li>provide truthful identity and business information;</li>
            <li>accurately describe services, pricing and material limitations;</li>
            <li>possess applicable registrations, licences, permissions and qualifications;</li>
            <li>not misrepresent the nature, quality, availability or characteristics of a service;</li>
            <li>not engage in unfair trade practices;</li>
            <li>not create or procure fake or misleading reviews;</li>
            <li>keep public contact and consumer-grievance information accurate;</li>
            <li>fulfil accepted service commitments in accordance with applicable law and booking terms; and</li>
            <li>cooperate with legitimate customer grievances and TakeItEsee trust or moderation reviews.</li>
          </ul>
          <p>These requirements are consistent with India&apos;s consumer-protection framework for marketplace sellers and service providers.</p>
        </section>

        <section id="provider-verification">
          <h2>7. Provider verification</h2>
          <p>TakeItEsee may require professionals and businesses to complete verification before certain marketplace features or public service publication become available.</p>
          <p>Verification may include review of identity, legal or business information and supporting evidence.</p>
          <p>A “Verified” status means that the provider has completed the verification steps required by TakeItEsee at that time. It is <strong>not a guarantee, warranty or endorsement</strong> of every service, qualification, conduct, quality, safety or future performance of that provider.</p>
          <p>TakeItEsee may request updated evidence, require reverification, revoke verification or restrict marketplace access where information becomes inaccurate, incomplete, expired, misleading, disputed or inconsistent with platform trust requirements.</p>
        </section>

        <section id="provider-public-disclosure">
          <h2>8. Provider public disclosure</h2>
          <p>Before a verified provider can publish eligible services, TakeItEsee may require consumer-facing information including:</p>
          <ul>
            <li>legal or business name;</li>
            <li>principal or registered address;</li>
            <li>public email and telephone contact;</li>
            <li>website, where applicable;</li>
            <li>grievance officer name;</li>
            <li>grievance officer designation;</li>
            <li>grievance email; and</li>
            <li>grievance telephone contact.</li>
          </ul>
          <p>This information may be displayed publicly on the relevant provider profile so consumers can identify and contact the provider regarding services and grievances.</p>
          <p>Private verification evidence and uploaded verification documents are not intended to become part of this public disclosure.</p>
        </section>

        <section id="service-listings">
          <h2>9. Service listings</h2>
          <p>Service listings must accurately describe the service being offered.</p>
          <p>Providers are responsible for keeping their listings reasonably current, including relevant scope, price, duration, location, availability and material limitations.</p>
          <p>TakeItEsee may refuse, pause, remove or restrict listings that are unlawful, misleading, unsafe, fraudulent, inactive, unverified, incomplete or otherwise inconsistent with applicable law or marketplace rules.</p>
          <p>Publication on TakeItEsee does not by itself establish that a service is suitable for every customer.</p>
        </section>

        <section id="search-discovery-ranking">
          <h2>10. Search, discovery and ranking</h2>
          <p>TakeItEsee may provide search, filtering and sorting controls based on information such as search relevance, category, location, price, rating, provider type and other marketplace signals shown through the service.</p>
          <p>Users may be able to select different sorting options.</p>
          <p>Search position or visibility is not guaranteed and may change as marketplace information, verification status, listings or product features change.</p>
        </section>

        <section id="bookings">
          <h2>11. Bookings</h2>
          <p>A booking is subject to the service information and booking terms displayed or confirmed before final confirmation.</p>
          <p>Customers and providers must review the relevant booking details, including the service, schedule, location and applicable terms.</p>
          <p>A booking may move through different platform states as it is requested, accepted, scheduled, rescheduled, performed, cancelled or completed.</p>
          <p>The provider remains responsible for delivering the agreed service, subject to applicable law and the booking-specific arrangement.</p>
        </section>

        <section id="cancellation-rescheduling-no-shows">
          <h2>12. Cancellation, rescheduling and no-shows</h2>
          <p>Cancellation and rescheduling rules may vary by service, provider, booking stage and circumstances.</p>
          <p><strong>Applicable cancellation and rescheduling terms will be shown or confirmed during the booking process before final confirmation where required.</strong></p>
          <p>TakeItEsee does not impose through these Terms a single universal cancellation charge or refund percentage for every service.</p>
          <p>Customers or providers may be required to provide a reason for cancellation, rescheduling or reported no-show events.</p>
          <p>Where consumer law provides a remedy because a service is deficient, materially different from what was represented, improperly refused or otherwise fails applicable legal requirements, these Terms do not remove that statutory remedy.</p>
          <p>The Consumer Protection Act recognises remedies relating to deficiencies in services and prevents unfair contractual terms that unreasonably disadvantage consumers.</p>
        </section>

        <section id="payments-refunds">
          <h2>13. Payments and refunds</h2>
          <p>Where TakeItEsee makes an online payment, collection, refund or similar payment feature available in the future, additional transaction-specific terms may be displayed before the relevant transaction.</p>
          <p>The amount payable, payment method, applicable fees, cancellation consequences and refund conditions may depend on the relevant service and transaction.</p>
          <p>Nothing in these Terms guarantees that a particular payment method is available.</p>
          <p>Nothing in these Terms limits any refund or other remedy that a consumer is entitled to receive under applicable law.</p>
        </section>

        <section id="marketplace-communications">
          <h2>14. Marketplace communications</h2>
          <p>TakeItEsee may provide messaging or communication features to help customers and providers coordinate marketplace activity.</p>
          <p>Users must not use these features to:</p>
          <ul>
            <li>threaten, harass or abuse another person;</li>
            <li>send unlawful or fraudulent material;</li>
            <li>impersonate another person or organisation;</li>
            <li>distribute malware or malicious links;</li>
            <li>send spam or deceptive promotions;</li>
            <li>unlawfully disclose another person&apos;s private information; or</li>
            <li>infringe intellectual-property or other legal rights.</li>
          </ul>
          <p>TakeItEsee may investigate or moderate marketplace communications where reasonably necessary for safety, support, fraud prevention, legal compliance or enforcement of these Terms, subject to applicable privacy requirements.</p>
        </section>

        <section id="reviews-ratings">
          <h2>15. Reviews and ratings</h2>
          <p>Eligible customers may be able to submit reviews following qualifying service or booking activity.</p>
          <p>Reviews must reflect genuine experience and must not be fabricated, manipulated, misleading, defamatory, abusive or submitted in exchange for improper benefits.</p>
          <p>Providers must not create, purchase, arrange or encourage fake consumer reviews.</p>
          <p>Providers may be allowed to respond to eligible reviews.</p>
          <p>TakeItEsee may restrict or remove reviews where reasonably necessary to address fraud, abuse, unlawful content, platform manipulation or violations of marketplace rules.</p>
        </section>

        <section id="customer-provider-grievances">
          <h2>16. Customer and provider grievances</h2>
          <p>A consumer should first use the relevant provider&apos;s displayed grievance contact for issues concerning that provider&apos;s service where appropriate.</p>
          <p>Providers are responsible for maintaining an effective consumer-grievance contact and complying with applicable grievance-redress obligations.</p>
          <p>Under India&apos;s E-Commerce Rules, marketplace seller/service-provider grievance information is required to be made available to consumers, and applicable grievance obligations include timely acknowledgment and resolution.</p>
          <p>Customers may also contact TakeItEsee regarding platform-related concerns, safety issues, marketplace support or unresolved marketplace problems.</p>
        </section>

        <section id="takeitesee-grievance-officer" className={styles.contactSection}>
          <h2>17. TakeItEsee Grievance Officer</h2>
          <p>For TakeItEsee platform grievances:</p>
          <address>
            <strong>Grievance Officer:</strong> Aadhil<br />
            <strong>Operator:</strong> UV MART Enterprises Private Limited<br />
            <strong>Email:</strong> <a href="mailto:uandv.com@gmail.com">uandv.com@gmail.com</a><br />
            <strong>Address:</strong> 15/3 Green House Apart, McDonalds Road, Cantonment, Trichy - 620001, Tamil Nadu, India.
          </address>
          <p>Where the Consumer Protection (E-Commerce) Rules or another applicable law prescribes a response timeline, TakeItEsee will handle complaints in accordance with that requirement.</p>
          <p>The E-Commerce Rules form part of the current Consumer Protection Act framework published by the Department of Consumer Affairs.</p>
        </section>

        <section id="safety-user-judgment">
          <h2>18. Safety and user judgment</h2>
          <p>TakeItEsee uses verification, access controls, trust states, reviews, moderation and other measures intended to improve marketplace reliability.</p>
          <p>However, no marketplace verification process can eliminate all risks.</p>
          <p>Customers should use reasonable judgment appropriate to the service being requested, especially where a service involves entry into property, valuable assets, professional expertise or other safety considerations.</p>
          <p>Users should report suspected fraud, impersonation, unsafe conduct or other serious marketplace concerns.</p>
        </section>

        <section id="prohibited-use">
          <h2>19. Prohibited use</h2>
          <p>You must not use TakeItEsee to:</p>
          <ul>
            <li>violate applicable law;</li>
            <li>facilitate fraud or deception;</li>
            <li>offer or request unlawful services;</li>
            <li>impersonate another person or entity;</li>
            <li>submit materially false verification information;</li>
            <li>manipulate ratings or reviews;</li>
            <li>interfere with platform security or operation;</li>
            <li>attempt unauthorised access to accounts, systems or data;</li>
            <li>scrape or extract protected information in violation of law or platform rights;</li>
            <li>transmit malware or harmful code;</li>
            <li>harass, threaten or exploit another person;</li>
            <li>unlawfully infringe privacy, confidentiality or intellectual-property rights; or</li>
            <li>assist another person in doing any of these things.</li>
          </ul>
        </section>

        <section id="moderation-restrictions-suspension">
          <h2>20. Moderation, restrictions and suspension</h2>
          <p>TakeItEsee may investigate marketplace activity and may warn, restrict, pause, suspend, revoke verification from, or terminate access for an account, provider profile or listing where reasonably necessary because of:</p>
          <ul>
            <li>suspected fraud or abuse;</li>
            <li>inaccurate or misleading information;</li>
            <li>safety or trust concerns;</li>
            <li>repeated service or marketplace violations;</li>
            <li>unlawful conduct;</li>
            <li>verification failure;</li>
            <li>security risks;</li>
            <li>legal or regulatory requirements; or</li>
            <li>material violation of these Terms.</li>
          </ul>
          <p>Where appropriate and legally required, TakeItEsee may provide information about the action or a mechanism to seek review.</p>
          <p>Restoration of access or verification may be subject to corrective action or reverification.</p>
        </section>

        <section id="intellectual-property">
          <h2>21. Intellectual property</h2>
          <p>TakeItEsee and its associated software, branding, interface, platform content and other materials owned by UV MART Enterprises Private Limited or its licensors are protected by applicable intellectual-property laws.</p>
          <p>Except as permitted by law or expressly authorised, users may not copy, modify, distribute, reverse engineer, commercially exploit or misuse protected TakeItEsee materials.</p>
          <p>Users retain rights they lawfully hold in content they submit.</p>
          <p>By submitting content necessary for marketplace operation, a user grants TakeItEsee a non-exclusive licence to host, process, reproduce and display that content to the extent reasonably required to operate, secure and provide the marketplace and its features.</p>
          <p>You must have the rights necessary to submit content you provide.</p>
        </section>

        <section id="privacy">
          <h2>22. Privacy</h2>
          <p>Personal information is handled in accordance with the <a href="/privacy"><strong>TakeItEsee Privacy Policy</strong></a>.</p>
          <p>The Privacy Policy explains the categories of information processed, purposes of processing, browser storage, provider verification information, retention, security and privacy-request mechanisms.</p>
        </section>

        <section id="third-party-services-links">
          <h2>23. Third-party services and links</h2>
          <p>TakeItEsee may rely on or link to third-party technology, websites or services.</p>
          <p>Third parties may have their own terms and privacy practices.</p>
          <p>TakeItEsee is not responsible for independent third-party websites merely because the platform contains a link to them, except to the extent responsibility cannot legally be excluded.</p>
        </section>

        <section id="platform-availability">
          <h2>24. Platform availability</h2>
          <p>TakeItEsee may modify, improve, restrict or discontinue features as the marketplace evolves.</p>
          <p>The platform may occasionally be unavailable because of maintenance, security events, infrastructure failures or circumstances beyond reasonable control.</p>
          <p>TakeItEsee does not promise uninterrupted or error-free availability.</p>
          <p>However, this clause does not remove obligations imposed on TakeItEsee by applicable consumer, data-protection or other mandatory law.</p>
        </section>

        <section id="liability-statutory-rights">
          <h2>25. Liability and statutory consumer rights</h2>
          <p>Nothing in these Terms excludes or limits liability where exclusion or limitation is prohibited by law.</p>
          <p>Nothing in these Terms waives a consumer&apos;s rights under the <strong>Consumer Protection Act, 2019</strong>, applicable E-Commerce Rules or other mandatory law.</p>
          <p>To the extent legally permitted, TakeItEsee is not responsible for indirect or consequential loss caused solely by matters outside its reasonable control or by an independent provider&apos;s conduct where the law does not impose responsibility on TakeItEsee.</p>
          <p>Any limitation must be interpreted subject to applicable consumer law, including protections against unfair contracts and deficient services.</p>
        </section>

        <section id="responsibility-for-misuse">
          <h2>26. Responsibility for misuse</h2>
          <p>A user may be responsible, to the extent permitted by law, for losses or claims directly resulting from that user&apos;s fraud, unlawful conduct, wilful misuse of TakeItEsee, infringement of third-party rights or material breach of these Terms.</p>
          <p>This provision does not require a consumer to indemnify TakeItEsee for TakeItEsee&apos;s own negligence, statutory obligations or conduct for which liability cannot legally be transferred.</p>
        </section>

        <section id="ending-use">
          <h2>27. Ending use of TakeItEsee</h2>
          <p>You may stop using TakeItEsee at any time.</p>
          <p>Where account deletion is not available directly through account settings, eligible deletion or privacy requests may be submitted using the contact mechanism provided in the Privacy Policy.</p>
          <p>Ending an account does not automatically erase information that TakeItEsee is legally or reasonably required to retain for security, audit, fraud prevention, dispute resolution or compliance purposes.</p>
          <p>Rights, obligations and liabilities arising before account closure may continue where applicable.</p>
        </section>

        <section id="governing-law-disputes">
          <h2>28. Governing law and disputes</h2>
          <p>These Terms are governed by the laws of <strong>India</strong>.</p>
          <p>Nothing in this section prevents a consumer from using any forum, commission, authority or jurisdiction available to that consumer under mandatory consumer-protection law.</p>
          <p>For disputes that are not required by applicable law to be brought elsewhere, the courts having competent jurisdiction in <strong>Tiruchirappalli, Tamil Nadu, India</strong> will have jurisdiction.</p>
          <p>These Terms do <strong>not</strong> impose mandatory private arbitration on consumers.</p>
        </section>

        <section id="changes-to-terms">
          <h2>29. Changes to these Terms</h2>
          <p>TakeItEsee may update these Terms when platform features, business practices or applicable laws change.</p>
          <p>Where a change is material and notice is legally required, TakeItEsee will provide an appropriate notice through the platform or other available communication channel.</p>
          <p>The current version and effective date will be published on TakeItEsee.</p>
          <p>Continued use after an updated version takes effect may constitute acceptance where legally permitted.</p>
        </section>

        <section id="contact" className={styles.contactSection}>
          <h2>30. Contact</h2>
          <p>Questions concerning these Terms or the TakeItEsee marketplace may be directed to:</p>
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
