'use client';

import { useState } from 'react';
import { Input } from './primitives';

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, 'type'> & {
  showLabel?: string;
  hideLabel?: string;
};

export function PasswordInput({
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <Input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="button button-quiet password-visibility-toggle"
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? hideLabel : showLabel}
      </button>
    </div>
  );
}
