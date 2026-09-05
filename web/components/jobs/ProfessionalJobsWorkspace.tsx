'use client';

import { useState } from 'react';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import { JobOfferWorkspace } from './JobOfferWorkspace';
import styles from './JobMarketplace.module.css';
import { ProviderJobMarketplace } from './ProviderJobMarketplace';
import { SavedJobsWorkspace } from './SavedJobsWorkspace';

type ProfessionalJobsTab = 'applications' | 'saved' | 'offers';

export function ProfessionalJobsWorkspace() {
  const { locale } = useIdentityWorkspaceTranslations();
  const ta = locale.toLowerCase().startsWith('ta');
  const [activeTab, setActiveTab] = useState<ProfessionalJobsTab>('applications');

  return (
    <div className={styles.page}>
      <div
        className={styles.workspaceTabs}
        role="tablist"
        aria-label={ta ? 'Professional career workspace' : 'Professional career workspace'}
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
          {ta ? 'Applications & Interviews' : 'Applications & interviews'}
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
          {ta ? 'Saved Jobs' : 'Saved jobs'}
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
          {ta ? 'Employment Offers' : 'Employment offers'}
        </button>
      </div>

      <div
        id="professional-jobs-applications-panel"
        role="tabpanel"
        aria-labelledby="professional-jobs-applications-tab"
        hidden={activeTab !== 'applications'}
      >
        <ProviderJobMarketplace />
      </div>

      <div
        id="professional-jobs-saved-panel"
        role="tabpanel"
        aria-labelledby="professional-jobs-saved-tab"
        hidden={activeTab !== 'saved'}
      >
        <SavedJobsWorkspace />
      </div>

      <div
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
