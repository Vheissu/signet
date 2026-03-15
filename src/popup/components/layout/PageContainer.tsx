import { type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useStore } from '@/popup/store';

interface PageContainerProps {
  title?: string;
  showBack?: boolean;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function PageContainer({
  title,
  showBack = false,
  headerRight,
  children,
  className = '',
  noPadding = false,
}: PageContainerProps) {
  const goBack = useStore((s) => s.goBack);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg animate-fade-in">
      {/* Page header */}
      {(title || showBack) && (
        <div className="flex items-center justify-between px-5 h-14 border-b border-border bg-surface/80 backdrop-blur-md flex-shrink-0">
          <div className="flex items-center gap-3">
            {showBack && (
              <button
                onClick={goBack}
                className="p-1.5 -ml-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            {title && (
              <h2 className="text-base font-bold text-text-primary">{title}</h2>
            )}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}

      {/* Content */}
      <div
        className={`flex-1 overflow-y-auto ${noPadding ? '' : 'px-5 py-5'} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
