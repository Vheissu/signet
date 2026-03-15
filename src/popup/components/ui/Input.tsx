import {
  type InputHTMLAttributes,
  type ReactNode,
  forwardRef,
  useState,
} from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  rightElement?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, rightElement, type, className = '', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    return (
      <div className="w-full">
        {label && (
          <label className="block text-[11px] font-semibold text-text-secondary mb-2 tracking-widest uppercase">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary w-4 h-4 flex items-center justify-center">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={inputType}
            className={`
              w-full h-11 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary
              placeholder:text-text-tertiary
              focus:outline-none focus:border-hive/50 focus:ring-1 focus:ring-hive/20
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors duration-150
              ${icon ? 'pl-10 pr-4' : 'px-4'}
              ${isPassword || rightElement ? 'pr-12' : ''}
              ${error ? 'border-error/50 focus:border-error/70 focus:ring-error/20' : ''}
              ${className}
            `}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors p-1"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
          {rightElement && !isPassword && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-error">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-text-tertiary">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
