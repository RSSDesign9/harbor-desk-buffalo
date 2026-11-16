import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './icons.tsx';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;

export function TextField({ label, hint, error, ...rest }: InputProps & { label: string; hint?: string; error?: string }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      <input {...rest} id={id} className="input" aria-invalid={error ? true : undefined} aria-describedby={[hintId, errId].filter(Boolean).join(' ') || undefined} />
      {error ? (
        <span className="field-error" id={errId}>
          <Icon name="alert" size={16} />
          {error}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Search input with a real (visually hidden) label, a clear button, and Escape-to-clear.
 * Typing never triggers global shortcuts: the field owns its keys.
 */
export function SearchField({ label, value, onValueChange, placeholder, ...rest }: Omit<InputProps, 'value' | 'onChange' | 'type'> & { label: string; value: string; onValueChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="search" role="search">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Icon name="search" />
      <input
        {...rest}
        id={id}
        type="search"
        className="input"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            onValueChange('');
          }
        }}
      />
      {value ? (
        <button type="button" className="icon-btn search-clear" aria-label="Clear search" onClick={() => onValueChange('')} style={{ border: 0, background: 'transparent' }}>
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, description, ...rest }: Omit<InputProps, 'type'> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  const descId = description ? `${id}-desc` : undefined;
  return (
    <label className="checkbox" htmlFor={id}>
      <input {...rest} id={id} type="checkbox" aria-describedby={descId} />
      <span>{label}</span>
      {description ? (
        <span className="checkbox-desc" id={descId}>
          {description}
        </span>
      ) : null}
    </label>
  );
}
