'use client';

import { ReactNode, useId } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

export function Button({
  children,
  className = '',
  variant = 'primary',
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`button button-${variant} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? 'Working...' : children}
    </button>
  );
}

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

export function Input({ label, hint, error, required, id, ...props }: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  return (
    <div className="field">
      <label htmlFor={fieldId} className="field-label">
        {label}{required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={fieldId}
        className={`field-control ${error ? 'field-control-error' : ''}`}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...props}
      />
      {hint && !error ? <span id={hintId} className="field-hint">{hint}</span> : null}
      {error ? <span id={errorId} className="field-error" role="alert">{error}</span> : null}
    </div>
  );
}

export function Textarea({ label, hint, error, required, id, ...props }: FieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  return (
    <div className="field">
      <label htmlFor={fieldId} className="field-label">
        {label}{required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <textarea
        id={fieldId}
        className={`field-control field-textarea ${error ? 'field-control-error' : ''}`}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...props}
      />
      {hint && !error ? <span id={hintId} className="field-hint">{hint}</span> : null}
      {error ? <span id={errorId} className="field-error" role="alert">{error}</span> : null}
    </div>
  );
}

export function Select({ label, hint, error, required, id, children, ...props }: FieldProps & React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  return (
    <div className="field">
      <label htmlFor={fieldId} className="field-label">
        {label}{required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <select
        id={fieldId}
        className={`field-control ${error ? 'field-control-error' : ''}`}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...props}
      >
        {children}
      </select>
      {hint && !error ? <span id={hintId} className="field-hint">{hint}</span> : null}
      {error ? <span id={errorId} className="field-error" role="alert">{error}</span> : null}
    </div>
  );
}

type ChoiceProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string };

export function Checkbox({ label, description, id, ...props }: ChoiceProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label htmlFor={inputId} className="choice-row">
      <input id={inputId} type="checkbox" className="choice-input" {...props} />
      <span>
        <strong>{label}</strong>
        {description ? <span className="choice-description">{description}</span> : null}
      </span>
    </label>
  );
}

export function Radio({ label, description, id, ...props }: ChoiceProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label htmlFor={inputId} className="choice-row">
      <input id={inputId} type="radio" className="choice-input" {...props} />
      <span>
        <strong>{label}</strong>
        {description ? <span className="choice-description">{description}</span> : null}
      </span>
    </label>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Card({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <div className={`card ${className}`} {...props}>{children}</div>;
}

export function Alert({ children, tone = 'info', title }: { children: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'info'; title?: string }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      {title ? <strong>{title}</strong> : null}
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="state-panel">
      <span className="state-mark" aria-hidden="true">--</span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action ? <div className="state-action">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function ErrorState({ title = 'Something went wrong', children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="state-panel state-panel-error" role="alert">
      <span className="state-mark" aria-hidden="true">!</span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action ? <div className="state-action">{action}</div> : null}
    </div>
  );
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}>x</button>
        </div>
        {children}
      </section>
    </div>
  );
}
