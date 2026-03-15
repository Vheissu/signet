import { useState, useEffect } from 'react';
import {
  Bell,
  ArrowDownLeft,
  Gift,
  Zap,
  Users,
  PiggyBank,
  X,
  CheckCheck,
} from 'lucide-react';
import { Card } from '@/popup/components/ui/Card';
import { Button } from '@/popup/components/ui/Button';
import { useStore } from '@/popup/store';
import {
  getNotifications,
  markRead,
  markAllRead,
  clearNotifications,
  checkForNewActivity,
  getUnreadCount,
  type Notification,
} from '@/core/notifications/monitor';

export function NotificationBell() {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    loadUnread();
    // Poll for new notifications
    if (activeAccountName) {
      checkForNewActivity(activeAccountName).then(() => loadUnread());
    }
  }, [activeAccountName]);

  async function loadUnread() {
    const count = await getUnreadCount();
    setUnreadCount(count);
  }

  return (
    <>
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-elevated transition-colors relative"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-hive text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showPanel && (
        <NotificationPanel
          onClose={() => {
            setShowPanel(false);
            loadUnread();
          }}
        />
      )}
    </>
  );
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const navigateTo = useStore((s) => s.navigateTo);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    getNotifications().then(setNotifications);
  }, []);

  const handleTap = async (n: Notification) => {
    await markRead(n.id);
    if (n.actionPage) {
      navigateTo(n.actionPage as any, n.actionParams);
    }
    onClose();
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClear = async () => {
    await clearNotifications();
    setNotifications([]);
  };

  const iconForType = (type: Notification['type']) => {
    switch (type) {
      case 'transfer_in': return <ArrowDownLeft size={14} className="text-success" />;
      case 'reward_available': return <Gift size={14} className="text-warning" />;
      case 'power_down': return <Zap size={14} className="text-coral" />;
      case 'delegation_change': return <Users size={14} className="text-info" />;
      case 'savings_interest': return <PiggyBank size={14} className="text-success" />;
      default: return <Bell size={14} className="text-text-tertiary" />;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      {/* Panel */}
      <div className="absolute top-full right-4 mt-1.5 w-[340px] max-h-[420px] bg-surface-elevated border border-border rounded-2xl shadow-xl z-40 overflow-hidden animate-fade-in flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-text-primary">Notifications</h3>
          <div className="flex items-center gap-1">
            {notifications.some((n) => !n.read) && (
              <button
                onClick={handleMarkAllRead}
                className="p-1.5 rounded-lg text-text-tertiary hover:text-success hover:bg-success/10 transition-colors"
                title="Mark all read"
              >
                <CheckCheck size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-overlay transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-text-tertiary">
              <Bell size={24} className="mb-2 opacity-40" />
              <p className="text-xs">No notifications yet</p>
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleTap(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-overlay ${
                    n.read ? 'opacity-60' : ''
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-surface-overlay flex items-center justify-center flex-shrink-0 mt-0.5">
                    {iconForType(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-text-primary truncate">{n.title}</p>
                      {!n.read && (
                        <div className="w-1.5 h-1.5 rounded-full bg-hive flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-text-tertiary truncate">{n.message}</p>
                    <p className="text-[10px] text-text-tertiary mt-0.5">
                      {formatTimeAgo(n.timestamp)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-border px-4 py-2">
            <button
              onClick={handleClear}
              className="text-[11px] text-text-tertiary hover:text-error transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
