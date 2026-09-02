'use client';

import { ReactNode, useId, useState } from 'react';
import { useDialogFocusTrap } from './useDialogFocusTrap';

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

export function Button({ children, className = '', variant = 'primary', loading = false, disabled, ...props }: ButtonProps) {
  return <button className={`button button-${variant} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading ? 'Working...' : children}</button>;
}

type FieldProps = { label: string; hint?: string; error?: string; required?: boolean };

export function Input({ label, hint, error, required, id, ...props }: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  return <div className="field"><label htmlFor={fieldId} className="field-label">{label}{required ? <span aria-hidden="true"> *</span> : null}</label><input id={fieldId} className={`field-control ${error ? 'field-control-error' : ''}`} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : hint ? hintId : undefined} {...props} />{hint && !error ? <span id={hintId} className="field-hint">{hint}</span> : null}{error ? <span id={errorId} className="field-error" role="alert">{error}</span> : null}</div>;
}

type PasswordInputProps = Omit<FieldProps & React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  showLabel?: string;
  hideLabel?: string;
};

export function PasswordInput({ showLabel = 'Show password', hideLabel = 'Hide password', ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return <div className="password-field"><Input {...props} type={visible ? 'text' : 'password'} /><button type="button" className="button button-quiet password-visibility-toggle" aria-pressed={visible} onClick={() => setVisible((current) => !current)}>{visible ? hideLabel : showLabel}</button></div>;
}

export function Textarea({ label, hint, error, required, id, ...props }: FieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId(); const fieldId = id ?? generatedId; const hintId = `${fieldId}-hint`; const errorId = `${fieldId}-error`;
  return <div className="field"><label htmlFor={fieldId} className="field-label">{label}{required ? <span aria-hidden="true"> *</span> : null}</label><textarea id={fieldId} className={`field-control field-textarea ${error ? 'field-control-error' : ''}`} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : hint ? hintId : undefined} {...props} />{hint && !error ? <span id={hintId} className="field-hint">{hint}</span> : null}{error ? <span id={errorId} className="field-error" role="alert">{error}</span> : null}</div>;
}

export function Select({ label, hint, error, required, id, children, ...props }: FieldProps & React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const generatedId = useId(); const fieldId = id ?? generatedId; const hintId = `${fieldId}-hint`; const errorId = `${fieldId}-error`;
  return <div className="field"><label htmlFor={fieldId} className="field-label">{label}{required ? <span aria-hidden="true"> *</span> : null}</label><select id={fieldId} className={`field-control ${error ? 'field-control-error' : ''}`} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : hint ? hintId : undefined} {...props}>{children}</select>{hint && !error ? <span id={hintId} className="field-hint">{hint}</span> : null}{error ? <span id={errorId} className="field-error" role="alert">{error}</span> : null}</div>;
}

type ChoiceProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string };
export function Checkbox({ label, description, id, ...props }: ChoiceProps) { const generatedId = useId(); const inputId = id ?? generatedId; return <label htmlFor={inputId} className="choice-row"><input id={inputId} type="checkbox" className="choice-input" {...props} /><span><strong>{label}</strong>{description ? <span className="choice-description">{description}</span> : null}</span></label>; }
export function Radio({ label, description, id, ...props }: ChoiceProps) { const generatedId = useId(); const inputId = id ?? generatedId; return <label htmlFor={inputId} className="choice-row"><input id={inputId} type="radio" className="choice-input" {...props} /><span><strong>{label}</strong>{description ? <span className="choice-description">{description}</span> : null}</span></label>; }
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
export function Card({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement> & { children: ReactNode }) { return <div className={`card ${className}`} {...props}>{children}</div>; }
export function Alert({ children, tone = 'info', title }: { children: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'info'; title?: string }) { return <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>{title ? <strong>{title}</strong> : null}<span>{children}</span></div>; }
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <div className="state-panel" role="status" aria-live="polite"><span className="state-mark" aria-hidden="true">--</span><h3>{title}</h3><p>{children}</p>{action ? <div className="state-action">{action}</div> : null}</div>; }
export function Skeleton({ className = '' }: { className?: string }) { return <span className={`skeleton ${className}`} aria-hidden="true" />; }

export function Modal({ open, title, children, onClose, actions }: { open: boolean; title: string; children: ReactNode; onClose: () => void; actions?: ReactNode }) {
  const titleId = useId();
  const dialogRef = useDialogFocusTrap<HTMLElement>({ open, onClose });
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} className="modal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><div className="modal-header"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}>×</button></div><div className="modal-body">{children}</div>{actions ? <div className="modal-actions">{actions}</div> : null}</section></div>;
}
