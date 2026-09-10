'use client';

import { useEffect } from 'react';

export function RequirementProposalDeepLinkFocus({ proposalReference }: { proposalReference?: string }) {
  useEffect(() => {
    const targetReference = proposalReference?.trim() ?? '';
    if (!/^PROP-[A-Z0-9-]{6,64}$/i.test(targetReference)) return;

    let focusedCard: HTMLElement | null = null;
    let addedTabIndex = false;

    const focusTarget = () => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>('.customer-proposal-card'));
      const card = cards.find((candidate) => {
        const reference = candidate.querySelector<HTMLElement>('.section-heading .eyebrow')?.textContent?.trim();
        return reference === targetReference;
      });
      if (!card) return false;

      focusedCard = card;
      card.classList.add('customer-proposal-notification-focus');
      if (!card.hasAttribute('tabindex')) {
        card.setAttribute('tabindex', '-1');
        addedTabIndex = true;
      }
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.focus({ preventScroll: true });
      return true;
    };

    if (focusTarget()) {
      return () => {
        focusedCard?.classList.remove('customer-proposal-notification-focus');
        if (addedTabIndex) focusedCard?.removeAttribute('tabindex');
      };
    }

    const root = document.getElementById('main-content') ?? document.body;
    const observer = new MutationObserver(() => {
      if (focusTarget()) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      focusedCard?.classList.remove('customer-proposal-notification-focus');
      if (addedTabIndex) focusedCard?.removeAttribute('tabindex');
    };
  }, [proposalReference]);

  return <style jsx global>{`
    .customer-proposal-card.customer-proposal-notification-focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 4px var(--color-selected);
      outline: 2px solid transparent;
    }
  `}</style>;
}
