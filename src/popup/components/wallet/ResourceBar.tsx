import { useHive } from '@/popup/hooks/useHive';

export function ResourceBar() {
  const { resources } = useHive();

  if (!resources) {
    return (
      <div className="space-y-2.5">
        <div className="shimmer h-12 rounded-2xl" />
        <div className="shimmer h-12 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <ResourceItem
        label="Voting Power"
        value={resources.votingPower}
        color="#E31337"
        bgColor="bg-hive/8"
      />
      <ResourceItem
        label="Resource Credits"
        value={resources.resourceCredits}
        color="#5CEAA0"
        bgColor="bg-success/8"
      />
    </div>
  );
}

function ResourceItem({
  label,
  value,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  const percentage = Math.min(Math.max(value, 0), 100);

  return (
    <div className={`${bgColor} rounded-2xl px-4 py-3 border border-border/50`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-text-secondary">{label}</span>
        <span className="text-xs font-extrabold text-text-primary">
          {percentage.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
