'use client';

import { useEffect, useState } from 'react';

const scrollThreshold = 600;

export default function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsVisible(window.scrollY > scrollThreshold);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  return (
    <button
      className={`back-to-top${isVisible ? ' back-to-top-visible' : ''}`}
      type="button"
      aria-label="Back to top"
      tabIndex={isVisible ? 0 : -1}
      onClick={handleClick}
    >
      <span aria-hidden="true">↑</span>
    </button>
  );
}
