import styles from './JobMarketplace.module.css';

type HiringJourneyGuideProps = {
  role: 'professional' | 'business';
  tamil: boolean;
};

export function HiringJourneyGuide({ role, tamil }: HiringJourneyGuideProps) {
  const professionalSteps = tamil
    ? ['Apply', 'Employer review', 'Shortlist & message', 'Interview', 'Offer decision', 'Hired']
    : ['Apply', 'Employer review', 'Shortlist & message', 'Interview', 'Offer decision', 'Hired'];
  const businessSteps = tamil
    ? ['Job post', 'Applicants review', 'Shortlist & message', 'Interview', 'Offer அனுப்பு', 'Accepted → Hired']
    : ['Post job', 'Review applicants', 'Shortlist & message', 'Interview', 'Send offer', 'Accepted → Hired'];
  const steps = role === 'professional' ? professionalSteps : businessSteps;

  return (
    <section className={`${styles.card} ${styles.section}`} aria-label={tamil ? 'Hiring journey' : 'Hiring journey'}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>{tamil ? 'Hiring journey' : 'Hiring journey'}</span>
          <h3>
            {role === 'professional'
              ? (tamil ? 'Job application எப்படி hire ஆகிறது?' : 'How your application becomes a hire')
              : (tamil ? 'Job post எப்படி hire ஆகிறது?' : 'How a job post becomes a hire')}
          </h3>
          <p className={styles.muted}>
            {role === 'professional'
              ? (tamil
                ? 'Business employer உங்கள் application-ஐ review செய்து shortlist/message, interview மற்றும் formal offer வழியாக முன்னேற்றுவார். Offer-ஐ நீங்கள் Accept செய்த பிறகே Hired status finalize ஆகும்.'
                : 'A Business employer reviews your application and can move it through shortlist/message, interview and a formal offer. Hired is finalized only after you accept the offer.')
              : (tamil
                ? 'Professional applicant apply செய்த பிறகு review, shortlist/message, interview மற்றும் formal offer வழியாக hiring complete செய்யலாம். Applicant offer-ஐ Accept செய்த பிறகே Hired finalize ஆகும்.'
                : 'After a Professional applies, move the candidate through review, shortlist/message, interview and a formal offer. Hired is finalized only after the applicant accepts the offer.')}
          </p>
        </div>
      </div>
      <div className={styles.meta} aria-label={tamil ? 'Hiring stages' : 'Hiring stages'}>
        {steps.map((step, index) => <span className={styles.pill} key={step}>{index + 1}. {step}</span>)}
      </div>
    </section>
  );
}
