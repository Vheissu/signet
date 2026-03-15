interface AvatarProps {
  username: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ username, size = 'md', className = '' }: AvatarProps) {
  const sizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
  };

  // Use Hive profile image
  const imageUrl = `https://images.hive.blog/u/${username}/avatar/small`;

  return (
    <div
      className={`${sizes[size]} rounded-full overflow-hidden bg-surface-elevated border border-border flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <img
        src={imageUrl}
        alt={username}
        className="w-full h-full object-cover"
        onError={(e) => {
          // Fallback to initial letter
          const target = e.currentTarget;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent && !parent.querySelector('span')) {
            const span = document.createElement('span');
            span.className = `${textSizes[size]} font-bold text-hive uppercase`;
            span.textContent = username[0] || '?';
            parent.appendChild(span);
          }
        }}
      />
    </div>
  );
}
