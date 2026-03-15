import { useState, useEffect } from 'react';
import { UserPlus, Search, Trash2, ArrowUpRight, Edit3, Check, X } from 'lucide-react';
import { PageContainer } from '@/popup/components/layout/PageContainer';
import { Input } from '@/popup/components/ui/Input';
import { Button } from '@/popup/components/ui/Button';
import { Card } from '@/popup/components/ui/Card';
import { Avatar } from '@/popup/components/ui/Avatar';
import { Modal } from '@/popup/components/ui/Modal';
import { useStore } from '@/popup/store';
import {
  getContacts,
  saveContact,
  removeContact,
  searchContacts,
  type Contact,
} from '@/core/contacts';
import { getAccount } from '@/core/hive/client';

export function Contacts() {
  const navigateTo = useStore((s) => s.navigateTo);
  const addToast = useStore((s) => s.addToast);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    if (search) {
      searchContacts(search).then(setContacts);
    } else {
      loadContacts();
    }
  }, [search]);

  async function loadContacts() {
    const list = await getContacts();
    setContacts(list);
  }

  const handleAdd = async () => {
    if (!newUsername) return;
    setIsAdding(true);

    const clean = newUsername.replace('@', '').trim().toLowerCase();

    // Verify account exists
    const account = await getAccount(clean);
    if (!account) {
      addToast(`@${clean} not found on chain`, 'error');
      setIsAdding(false);
      return;
    }

    await saveContact({
      username: clean,
      label: newLabel.trim() || undefined,
      lastUsed: Date.now(),
      useCount: 0,
    });

    addToast(`@${clean} added to contacts`, 'success');
    setNewUsername('');
    setNewLabel('');
    setShowAdd(false);
    setIsAdding(false);
    loadContacts();
  };

  const handleRemove = async (username: string) => {
    await removeContact(username);
    addToast(`@${username} removed`, 'info');
    loadContacts();
  };

  const handleSaveLabel = async (username: string) => {
    await saveContact({
      username,
      label: editLabel.trim() || undefined,
      lastUsed: Date.now(),
      useCount: contacts.find((c) => c.username === username)?.useCount || 0,
    });
    setEditingContact(null);
    loadContacts();
  };

  const handleSendTo = (username: string) => {
    navigateTo('send', { to: username });
  };

  return (
    <PageContainer
      title="Contacts"
      showBack
      headerRight={
        <button
          onClick={() => setShowAdd(true)}
          className="p-1.5 rounded-lg text-hive hover:bg-hive/10 transition-colors"
        >
          <UserPlus size={18} />
        </button>
      }
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full h-10 bg-surface-elevated border border-border rounded-xl pl-9 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-hive/50"
          />
        </div>

        {/* Contact list */}
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
            <UserPlus size={28} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">
              {search ? 'No contacts match' : 'No contacts yet'}
            </p>
            <p className="text-xs mt-1">
              {search ? '' : 'Contacts are auto-saved when you send transfers'}
            </p>
            {!search && (
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)} className="mt-3">
                Add a contact
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {contacts.map((contact) => (
              <Card key={contact.username} variant="elevated" padding="none">
                <div className="flex items-center gap-3 px-3.5 py-3">
                  <Avatar username={contact.username} size="sm" />

                  <div className="flex-1 min-w-0">
                    {editingContact === contact.username ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="Nickname"
                          className="flex-1 bg-surface-overlay rounded-lg px-2 py-1 text-sm text-text-primary border border-border focus:outline-none focus:border-hive/50"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveLabel(contact.username)}
                          className="p-1 text-success hover:bg-success/10 rounded-lg"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingContact(null)}
                          className="p-1 text-text-tertiary hover:bg-surface-overlay rounded-lg"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-text-primary">
                            @{contact.username}
                          </p>
                          <button
                            onClick={() => {
                              setEditingContact(contact.username);
                              setEditLabel(contact.label || '');
                            }}
                            className="p-0.5 text-text-tertiary hover:text-text-secondary"
                          >
                            <Edit3 size={10} />
                          </button>
                        </div>
                        <p className="text-[10px] text-text-tertiary truncate">
                          {contact.label || `${contact.useCount} transaction${contact.useCount !== 1 ? 's' : ''}`}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleSendTo(contact.username)}
                      className="p-2 rounded-lg text-hive hover:bg-hive/10 transition-colors"
                      title="Send"
                    >
                      <ArrowUpRight size={15} />
                    </button>
                    <button
                      onClick={() => handleRemove(contact.username)}
                      className="p-2 rounded-lg text-text-tertiary hover:text-error hover:bg-error/10 transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add contact modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Contact">
        <div className="space-y-4">
          <Input
            label="Hive Username"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Enter username"
            icon={<span className="text-text-tertiary font-bold text-sm">@</span>}
            autoFocus
          />
          <Input
            label="Nickname (Optional)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder='e.g. "Mom", "Business"'
          />
          <Button
            fullWidth
            size="lg"
            onClick={handleAdd}
            loading={isAdding}
            disabled={!newUsername}
          >
            Add Contact
          </Button>
        </div>
      </Modal>
    </PageContainer>
  );
}
