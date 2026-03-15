import { type ReactNode, type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'gradient' | 'outline';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Card({
  variant = 'default',
  padding = 'md',
  children,
  className = '',
  ...props
}: CardProps) {
  const variants = {
    default: 'bg-surface border border-border',
    elevated: 'bg-surface-elevated border border-border',
    gradient: 'bg-surface border border-border-accent gradient-card',
    outline: 'bg-transparent border border-border',
  };

  const paddings = {
    none: '',
    sm: 'p-3.5',
    md: 'p-4',
    lg: 'p-5',
  };

  return (
    <div
      className={`rounded-xl ${variants[variant]} ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
