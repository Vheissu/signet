interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`${sizes[size]} ${className}`}>
      <svg className="animate-spin" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12" cy="12" r="10"
          stroke="currentColor"
          strokeWidth="2.5"
          className="opacity-10"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="url(#sg)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="sg" x1="12" y1="2" x2="22" y2="12">
            <stop stopColor="#E31337" />
            <stop offset="1" stopColor="#F4845F" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
