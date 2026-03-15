import { type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-hive/50';

  const variants = {
    primary:
      'bg-hive text-white hover:bg-hive-light active:bg-hive-dark disabled:bg-hive/30 disabled:text-white/50 btn-shine shadow-sm shadow-hive/20',
    secondary:
      'bg-surface-elevated text-text-primary border border-border hover:bg-surface-overlay hover:border-border-accent active:bg-surface disabled:opacity-40',
    ghost:
      'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-elevated active:bg-surface-overlay disabled:opacity-40',
    danger:
      'bg-error/10 text-error border border-error/20 hover:bg-error/20 active:bg-error/30 disabled:opacity-40',
  };

  const sizes = {
    sm: 'text-xs h-8 px-3',
    md: 'text-sm h-10 px-5',
    lg: 'text-sm h-12 px-6',
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${
        fullWidth ? 'w-full' : ''
      } ${disabled || loading ? 'pointer-events-none' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : icon ? (
        <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
