'use client';

import { useId, useState } from 'react';

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  showLabel?: string;
  hideLabel?: string;
};

export function PasswordInput({
  label,
  hint,
  error,
  required,
  id,
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  ...props
}: PasswordInputProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label htmlFor={fieldId} className="field-label">
        {label}{required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={fieldId}
          className={`field-control ${error ? 'field-control-error' : ''}`}
          style={{ paddingRight: '3rem' }}
          type={visible ? 'text' : 'password'}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          {...props}
        />
        <button
          type="button"
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          title={visible ? hideLabel : showLabel}
          onClick={() => setVisible((current) => !current)}
          style={{
            position: 'absolute',
            top: '50%',
            right: '.55rem',
            transform: 'translateY(-50%)',
            width: '2.25rem',
            height: '2.25rem',
            display: 'grid',
            placeItems: 'center',
            border: 0,
            borderRadius: '.65rem',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {visible ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                <path d="M9.9 4.2A10.9 10.9 0 0112 4c5.5 0 9.5 4.8 10 8-.2 1.3-1 2.9-2.3 4.3" />
                <path d="M6.2 6.2C3.8 7.8 2.3 10.2 2 12c.5 3.2 4.5 8 10 8 1.5 0 2.9-.4 4.1-1" />
              </>
            ) : (
              <>
                <path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
      {hint && !error ? <span id={hintId} className="field-hint">{hint}</span> : null}
      {error ? <span id={errorId} className="field-error" role="alert">{error}</span> : null}
    </div>
  );
}
