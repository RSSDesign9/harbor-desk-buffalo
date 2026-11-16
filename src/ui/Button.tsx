import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './icons.tsx';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Swaps the label for a spinner while keeping the width; the button is not clickable while loading. */
  loading?: boolean;
  icon?: IconName;
  block?: boolean;
  children: ReactNode;
};

/** DESIGN §8 buttons: Work Sans 15/600 sentence case, 40 px tall, radius-sm. */
export function Button({ variant = 'secondary', loading = false, icon, block = false, className, disabled, children, type = 'button', ...rest }: Props) {
  return (
    <button
      {...rest}
      type={type}
      className={['btn', `btn-${variant}`, block ? 'btn-block' : '', className ?? ''].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      <span className="btn-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {icon ? <Icon name={icon} size={16} /> : null}
        {children}
      </span>
      {loading ? (
        <span className="btn-spinner">
          <span className="spinner" aria-hidden="true" />
          <span className="sr-only">Working</span>
        </span>
      ) : null}
    </button>
  );
}

export function IconButton({ label, icon, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & { label: string; icon: IconName }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}
