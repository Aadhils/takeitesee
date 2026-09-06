'use client';

import { useState } from 'react';
import LocalizedAccountShell from '../account/LocalizedAccountShell';
import CustomerRequirementDetail from './CustomerRequirementDetail';
import { RequirementOccurrenceRecoveryPanel } from './RequirementOccurrenceRecoveryPanel';

export function CustomerRequirementWorkspace({ requirementId }: { requirementId: string }) {
  const [detailVersion, setDetailVersion] = useState(0);

  return <LocalizedAccountShell active="/requirements">
    <div style={{ display: 'grid', gap: '1rem' }}>
      <CustomerRequirementDetail key={detailVersion} requirementId={requirementId} />
      <RequirementOccurrenceRecoveryPanel
        requirementId={requirementId}
        onRecovered={() => setDetailVersion((current) => current + 1)}
      />
    </div>
  </LocalizedAccountShell>;
}
