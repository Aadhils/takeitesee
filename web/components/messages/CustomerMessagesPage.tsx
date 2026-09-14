'use client';

import { useEffect, useState } from 'react';
import LocalizedAccountShell from '../account/LocalizedAccountShell';
import { getSupabaseBrowserUser } from '../../services/auth-adapter';
import { getCustomerProfile } from '../../services/customer-profile';
import { MarketplaceMessagingWorkspace } from './MarketplaceMessagingWorkspace';
import styles from './MarketplaceMessagingResponsive.module.css';

export function CustomerMessagesPage({ initialConversationId = '' }: { initialConversationId?: string }) {
  const [customerName, setCustomerName] = useState('Your account');

  useEffect(() => {
    let cancelled = false;
    void getSupabaseBrowserUser().then(async (user) => {
      if (!user) return;
      try {
        const profile = await getCustomerProfile(user.id, user.email ?? undefined);
        if (!cancelled) setCustomerName(profile.displayName || 'Your account');
      } catch { }
    });
    return () => { cancelled = true; };
  }, []);

  return <LocalizedAccountShell active="/messages" customerName={customerName}>
    <div className={styles.shell}>
      <MarketplaceMessagingWorkspace initialConversationId={initialConversationId} />
    </div>
  </LocalizedAccountShell>;
}
