import { describe, it, expect, beforeEach } from 'vitest';
import {
  getContacts,
  saveContact,
  removeContact,
  recordTransaction,
  searchContacts,
} from './index';

describe('Contacts', () => {
  beforeEach(async () => {
    // Clear contacts
    await chrome.storage.local.set({ contacts: [] });
  });

  describe('saveContact / getContacts', () => {
    it('saves and retrieves a contact', async () => {
      await saveContact({
        username: 'alice',
        label: 'Friend',
        lastUsed: Date.now(),
        useCount: 1,
      });

      const contacts = await getContacts();
      expect(contacts).toHaveLength(1);
      expect(contacts[0].username).toBe('alice');
      expect(contacts[0].label).toBe('Friend');
    });

    it('updates an existing contact', async () => {
      await saveContact({ username: 'alice', lastUsed: 100, useCount: 1 });
      await saveContact({ username: 'alice', label: 'Updated', lastUsed: 200, useCount: 5 });

      const contacts = await getContacts();
      expect(contacts).toHaveLength(1);
      expect(contacts[0].label).toBe('Updated');
      expect(contacts[0].useCount).toBe(5);
    });

    it('returns contacts sorted by most recently used', async () => {
      await saveContact({ username: 'old', lastUsed: 100, useCount: 1 });
      await saveContact({ username: 'new', lastUsed: 300, useCount: 1 });
      await saveContact({ username: 'mid', lastUsed: 200, useCount: 1 });

      const contacts = await getContacts();
      expect(contacts.map((c) => c.username)).toEqual(['new', 'mid', 'old']);
    });
  });

  describe('removeContact', () => {
    it('removes a contact by username', async () => {
      await saveContact({ username: 'alice', lastUsed: Date.now(), useCount: 1 });
      await saveContact({ username: 'bob', lastUsed: Date.now(), useCount: 1 });

      await removeContact('alice');
      const contacts = await getContacts();
      expect(contacts).toHaveLength(1);
      expect(contacts[0].username).toBe('bob');
    });

    it('does nothing for non-existent contact', async () => {
      await saveContact({ username: 'alice', lastUsed: Date.now(), useCount: 1 });
      await removeContact('nonexistent');
      const contacts = await getContacts();
      expect(contacts).toHaveLength(1);
    });
  });

  describe('recordTransaction', () => {
    it('creates a new contact on first transaction', async () => {
      await recordTransaction('charlie');
      const contacts = await getContacts();
      expect(contacts).toHaveLength(1);
      expect(contacts[0].username).toBe('charlie');
      expect(contacts[0].useCount).toBe(1);
    });

    it('increments useCount on repeat transactions', async () => {
      await recordTransaction('charlie');
      await recordTransaction('charlie');
      await recordTransaction('charlie');

      const contacts = await getContacts();
      expect(contacts[0].useCount).toBe(3);
    });
  });

  describe('searchContacts', () => {
    it('searches by username', async () => {
      await saveContact({ username: 'alice', lastUsed: Date.now(), useCount: 1 });
      await saveContact({ username: 'bob', lastUsed: Date.now(), useCount: 1 });

      const results = await searchContacts('ali');
      expect(results).toHaveLength(1);
      expect(results[0].username).toBe('alice');
    });

    it('searches by label', async () => {
      await saveContact({ username: 'alice', label: 'Business', lastUsed: Date.now(), useCount: 1 });
      await saveContact({ username: 'bob', label: 'Friend', lastUsed: Date.now(), useCount: 1 });

      const results = await searchContacts('bus');
      expect(results).toHaveLength(1);
      expect(results[0].username).toBe('alice');
    });

    it('returns all contacts for empty query', async () => {
      await saveContact({ username: 'alice', lastUsed: Date.now(), useCount: 1 });
      await saveContact({ username: 'bob', lastUsed: Date.now(), useCount: 1 });

      const results = await searchContacts('');
      expect(results).toHaveLength(2);
    });

    it('handles @ prefix in search', async () => {
      await saveContact({ username: 'alice', lastUsed: Date.now(), useCount: 1 });

      const results = await searchContacts('@alice');
      expect(results).toHaveLength(1);
    });
  });
});
