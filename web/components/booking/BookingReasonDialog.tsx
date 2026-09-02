'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';
import { useDialogFocusTrap } from '../ui/useDialogFocusTrap';

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

const tamilReasonLabels: Record<string, string> = {
  'Timing no longer works': 'இந்த நேரம் இனி பொருந்தவில்லை',
  'Work or personal commitment': 'வேலை அல்லது தனிப்பட்ட பொறுப்பு',
  'Travel or delay': 'பயணம் அல்லது தாமதம்',
  'Need a different day': 'வேறு நாள் தேவை',
  'Schedule conflict': 'அட்டவணை மோதல்',
  'Service unavailable': 'சேவை கிடைக்கவில்லை',
  'Outside service area': 'சேவை பகுதிக்கு வெளியே',
  'Unable to fulfil request': 'கோரிக்கையை நிறைவேற்ற முடியவில்லை',
  'New time unavailable': 'புதிய நேரம் கிடைக்கவில்லை',
  'Unable to fulfil at requested time': 'கோரிய நேரத்தில் சேவை வழங்க முடியவில்லை',
  'Change of plans': 'திட்ட மாற்றம்',
  'Found another provider': 'வேறு வழங்குநரை தேர்வு செய்தேன்',
  'Service no longer needed': 'சேவை இனி தேவையில்லை',
  'Incorrect booking details': 'புக்கிங் விவரங்கள் தவறாக உள்ளன',
  'Other': 'மற்றவை',
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
  const { t, locale } = useRemainingWorkspaceTranslations();
  const [category, setCategory] = useState('');
  const [detail, setDetail] = useState('');
  const titleId = useId();
  const dialogRef = useDialogFocusTrap<HTMLDivElement>({ open, onClose, canClose: !busy });

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

  const optionLabel = (option: string) => locale === 'ta-IN' ? tamilReasonLabels[option] ?? option : option;

  return (
    <div
      role="presentation"
      onClick={() => { if (!busy) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: '1rem', background: 'rgba(15, 23, 42, .5)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{ width: 'min(100%, 34rem)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 20px 60px rgba(15, 23, 42, .25)' }}
      >
        <span className="eyebrow">{eyebrow}</span>
        <h2 id={titleId} style={{ marginTop: '.5rem' }}>{title}</h2>
        <p className="detail-copy">{description}</p>

        <label style={{ display: 'grid', gap: '.45rem', marginTop: '1rem' }}>
          <strong>{t('reason.reason')}</strong>
          <select
            value={category}
            disabled={busy}
            onChange={(event) => setCategory(event.target.value)}
            style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', background: '#fff', font: 'inherit' }}
          >
            <option value="">{t('reason.choose')}</option>
            {options.map((option) => <option key={option} value={option}>{optionLabel(option)}</option>)}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '.45rem', marginTop: '1rem' }}>
          <strong>{category === 'Other' ? t('reason.details') : t('reason.additional')}</strong>
          <textarea
            value={detail}
            disabled={busy}
            maxLength={400}
            rows={4}
            onChange={(event) => setDetail(event.target.value)}
            placeholder={category === 'Other' ? t('reason.explain') : t('reason.context')}
            style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', font: 'inherit', resize: 'vertical' }}
          />
        </label>
        <p className="summary-note" style={{ marginTop: '.5rem' }}>{t('reason.auditNote')}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginTop: '1rem' }}>
          <button type="button" className="button button-secondary" disabled={busy} onClick={onClose}>{t('reason.goBack')}</button>
          <button type="button" className="button" disabled={busy || !valid} onClick={() => void onConfirm(reason)}>{busy ? t('reason.updating') : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
