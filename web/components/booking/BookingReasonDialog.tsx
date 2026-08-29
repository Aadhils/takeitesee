'use client';

import { useEffect, useMemo, useState } from 'react';

type BookingReasonDialogProps = {
  open: boolean;
  eyebrow: string;
  title: string;
  description: string;
  options: string[];
  confirmLabel: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
};

export default function BookingReasonDialog({
  open,
  eyebrow,
  title,
  description,
  options,
  confirmLabel,
  busy = false,
  onClose,
  onConfirm,
}: BookingReasonDialogProps) {
  const [category, setCategory] = useState('');
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (open) {
      setCategory('');
      setDetail('');
    }
  }, [open]);

  const reason = useMemo(() => {
    const cleanDetail = detail.trim();
    if (!category) return '';
    return cleanDetail ? `${category}: ${cleanDetail}` : category;
  }, [category, detail]);

  const valid = Boolean(category) && (category !== 'Other' || detail.trim().length >= 3) && reason.length <= 500;
  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={() => { if (!busy) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: '1rem', background: 'rgba(15, 23, 42, .5)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-reason-title"
        onClick={(event) => event.stopPropagation()}
        style={{ width: 'min(100%, 34rem)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 20px 60px rgba(15, 23, 42, .25)' }}
      >
        <span className="eyebrow">{eyebrow}</span>
        <h2 id="booking-reason-title" style={{ marginTop: '.5rem' }}>{title}</h2>
        <p className="detail-copy">{description}</p>

        <label style={{ display: 'grid', gap: '.45rem', marginTop: '1rem' }}>
          <strong>Reason</strong>
          <select
            value={category}
            disabled={busy}
            onChange={(event) => setCategory(event.target.value)}
            style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', background: '#fff', font: 'inherit' }}
          >
            <option value="">Choose a reason</option>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '.45rem', marginTop: '1rem' }}>
          <strong>{category === 'Other' ? 'Details' : 'Additional details (optional)'}</strong>
          <textarea
            value={detail}
            disabled={busy}
            maxLength={400}
            rows={4}
            onChange={(event) => setDetail(event.target.value)}
            placeholder={category === 'Other' ? 'Please explain the reason' : 'Add useful context'}
            style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', font: 'inherit', resize: 'vertical' }}
          />
        </label>
        <p className="summary-note" style={{ marginTop: '.5rem' }}>This reason is saved in the booking lifecycle for support and audit history.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginTop: '1rem' }}>
          <button type="button" className="button button-secondary" disabled={busy} onClick={onClose}>Go back</button>
          <button type="button" className="button" disabled={busy || !valid} onClick={() => void onConfirm(reason)}>{busy ? 'Updating…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
