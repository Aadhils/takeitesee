'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useProviderJobsTranslations } from '../i18n/ProviderJobsTranslations';
import { HiringJourneyGuide } from './HiringJourneyGuide';
import { JobOfferWorkspace } from './JobOfferWorkspace';
import styles from './JobMarketplace.module.css';
import { ProviderJobMarketplace } from './ProviderJobMarketplace';
import responsiveStyles from './ProfessionalJobsResponsive.module.css';
import { SavedJobsWorkspace } from './SavedJobsWorkspace';

type ProfessionalJobsTab = 'applications' | 'saved' | 'offers';

export function ProfessionalJobsWorkspace() {
  const { t } = useProviderJobsTranslations();
  const [activeTab, setActiveTab] = useState<ProfessionalJobsTab>('applications');

  return (
    <div className={`${styles.page} ${responsiveStyles.professionalJobsJourney}`}>
      <section className={`${styles.card} ${styles.section} ${responsiveStyles.heroCard}`}>
        <div className={`${styles.sectionHeading} ${responsiveStyles.heroHeading}`}>
          <div>
            <span className={styles.eyebrow}>{t('providerJobs.professional.eyebrow')}</span>
            <h2>{t('providerJobs.professional.title')}</h2>
            <p className={styles.muted}>{t('providerJobs.professional.intro')}</p>
          </div>
          <div className={`${styles.actions} ${responsiveStyles.heroActions}`}>
            <Link className={styles.button} href="/jobs">{t('providerJobs.professional.findJobs')}</Link>
            <Link className={`${styles.button} ${styles.secondary}`} href="/provider/resume">{t('providerJobs.professional.myResume')}</Link>
          </div>
        </div>
      </section>

      <HiringJourneyGuide role="professional" />

      <div
        className={`${styles.workspaceTabs} ${responsiveStyles.tabList}`}
        role="tablist"
        aria-label={t('providerJobs.professional.tabsAria')}
      >
        <button
          id="professional-jobs-applications-tab"
          className={`${styles.tabButton} ${activeTab === 'applications' ? styles.tabActive : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'applications'}
          aria-controls="professional-jobs-applications-panel"
          onClick={() => setActiveTab('applications')}
        >
          {t('providerJobs.professional.tabs.applications')}
        </button>
        <button
          id="professional-jobs-saved-tab"
          className={`${styles.tabButton} ${activeTab === 'saved' ? styles.tabActive : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'saved'}
          aria-controls="professional-jobs-saved-panel"
          onClick={() => setActiveTab('saved')}
        >
          {t('providerJobs.professional.tabs.saved')}
        </button>
        <button
          id="professional-jobs-offers-tab"
          className={`${styles.tabButton} ${activeTab === 'offers' ? styles.tabActive : ''}`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'offers'}
          aria-controls="professional-jobs-offers-panel"
          onClick={() => setActiveTab('offers')}
        >
          {t('providerJobs.professional.tabs.offers')}
        </button>
      </div>

      <div
        className={responsiveStyles.tabPanel}
        id="professional-jobs-applications-panel"
        role="tabpanel"
        aria-labelledby="professional-jobs-applications-tab"
        hidden={activeTab !== 'applications'}
      >
        <ProviderJobMarketplace />
      </div>

      <div
        className={responsiveStyles.tabPanel}
        id="professional-jobs-saved-panel"
        role="tabpanel"
        aria-labelledby="professional-jobs-saved-tab"
        hidden={activeTab !== 'saved'}
      >
        <SavedJobsWorkspace />
      </div>

      <div
        className={responsiveStyles.tabPanel}
        id="professional-jobs-offers-panel"
        role="tabpanel"
        aria-labelledby="professional-jobs-offers-tab"
        hidden={activeTab !== 'offers'}
      >
        <JobOfferWorkspace />
      </div>
    </div>
  );
}
