'use client';

import { useProviderJobsTranslations, type ProviderJobsKey } from '../i18n/ProviderJobsTranslations';
import styles from './JobMarketplace.module.css';

type HiringJourneyGuideProps = {
  role: 'professional' | 'business';
};

export function HiringJourneyGuide({ role }: HiringJourneyGuideProps) {
  const { t } = useProviderJobsTranslations();
  const professionalSteps: ProviderJobsKey[] = [
    'providerJobs.journey.professional.step.apply',
    'providerJobs.journey.professional.step.employerReview',
    'providerJobs.journey.professional.step.shortlistMessage',
    'providerJobs.journey.professional.step.interview',
    'providerJobs.journey.professional.step.offerDecision',
    'providerJobs.journey.professional.step.hired',
  ];
  const businessSteps: ProviderJobsKey[] = [
    'providerJobs.journey.business.step.postJob',
    'providerJobs.journey.business.step.reviewApplicants',
    'providerJobs.journey.business.step.shortlistMessage',
    'providerJobs.journey.business.step.interview',
    'providerJobs.journey.business.step.sendOffer',
    'providerJobs.journey.business.step.acceptedHired',
  ];
  const steps = role === 'professional' ? professionalSteps : businessSteps;

  return (
    <section className={`${styles.card} ${styles.section}`} aria-label={t('providerJobs.journey.aria')}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>{t('providerJobs.journey.eyebrow')}</span>
          <h3>{t(role === 'professional' ? 'providerJobs.journey.professional.title' : 'providerJobs.journey.business.title')}</h3>
          <p className={styles.muted}>{t(role === 'professional' ? 'providerJobs.journey.professional.body' : 'providerJobs.journey.business.body')}</p>
        </div>
      </div>
      <div className={styles.meta} aria-label={t('providerJobs.journey.stagesAria')}>
        {steps.map((step, index) => <span className={styles.pill} key={step}>{index + 1}. {t(step)}</span>)}
      </div>
    </section>
  );
}
