import { describe, it, expect } from 'vitest';
import { parsePasswordManagerCSV, isWifKey } from './csv-parser';

describe('CSV Parser', () => {
  describe('isWifKey', () => {
    it('recognizes valid WIF keys', () => {
      // A real-format WIF key (not a real key, just correct format)
      expect(isWifKey('5JVFFWRLwz6JoP9YamGe3N4EoVR3D9Khip5cT6Q8Np5XLQRDESZ')).toBe(true);
    });

    it('rejects strings that are too short', () => {
      expect(isWifKey('5JVF')).toBe(false);
    });

    it('rejects strings that don\'t start with 5', () => {
      expect(isWifKey('6JVFFWRLwz6JoP9YamGe3N4EoVR3D9Khip5cT6Q8Np5XLQRDESZ')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isWifKey('')).toBe(false);
    });

    it('rejects strings with invalid base58 characters', () => {
      expect(isWifKey('5JVFF0RLwz6JoP9YamGe3N4EoVR3D9Khip5cT6Q8Np5XLQRDES0')).toBe(false);
    });
  });

  describe('parsePasswordManagerCSV - 1Password format', () => {
    it('extracts Hive entries from 1Password CSV', () => {
      // 1Password wraps multi-line notes in quotes with literal newlines
      const csv = [
        'Title,URL,Username,Password,Notes,Type',
        'Hive Account,https://hive.blog,alice,mypassword123,"Posting Key: 5JVFFWRLwz6JoP9YamGe3N4EoVR3D9Khip5cT6Q8Np5XLQRDESZ',
        'Active Key: 5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ",Login',
      ].join('\n');

      const accounts = parsePasswordManagerCSV(csv);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].username).toBe('alice');
      expect(accounts[0].source).toBe('onepassword');
      expect(accounts[0].keys.posting).toBeDefined();
      expect(accounts[0].keys.active).toBeDefined();
    });

    it('ignores non-Hive entries', () => {
      const csv = `Title,URL,Username,Password,Notes,Type
Gmail,https://gmail.com,user@gmail.com,password123,,Login
Twitter,https://twitter.com,myhandle,password456,,Login`;

      const accounts = parsePasswordManagerCSV(csv);
      expect(accounts).toHaveLength(0);
    });
  });

  describe('parsePasswordManagerCSV - LastPass format', () => {
    it('extracts Hive entries from LastPass CSV', () => {
      const csv = `url,username,password,extra,name,grouping,fav
https://peakd.com,bob,5JVFFWRLwz6JoP9YamGe3N4EoVR3D9Khip5cT6Q8Np5XLQRDESZ,"Memo Key: 5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ",Hive - Bob,Crypto,0`;

      const accounts = parsePasswordManagerCSV(csv);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].username).toBe('bob');
      expect(accounts[0].source).toBe('lastpass');
    });
  });

  describe('parsePasswordManagerCSV - Bitwarden format', () => {
    it('extracts Hive entries from Bitwarden CSV', () => {
      const csv = `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
Crypto,,login,Hive Account,"Owner Key: 5JVFFWRLwz6JoP9YamGe3N4EoVR3D9Khip5cT6Q8Np5XLQRDESZ",,0,https://hive.blog,charlie,mypassword,`;

      const accounts = parsePasswordManagerCSV(csv);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].username).toBe('charlie');
      expect(accounts[0].source).toBe('bitwarden');
    });
  });

  describe('parsePasswordManagerCSV - edge cases', () => {
    it('handles empty CSV', () => {
      expect(parsePasswordManagerCSV('')).toHaveLength(0);
    });

    it('handles CSV with only headers', () => {
      expect(parsePasswordManagerCSV('Title,URL,Username\n')).toHaveLength(0);
    });

    it('handles quoted fields with commas', () => {
      const csv = `Title,URL,Username,Password,Notes,Type
"Hive, Main",https://hive.blog,alice,pass,"Posting Key: 5JVFFWRLwz6JoP9YamGe3N4EoVR3D9Khip5cT6Q8Np5XLQRDESZ",Login`;

      const accounts = parsePasswordManagerCSV(csv);
      expect(accounts).toHaveLength(1);
      expect(accounts[0].title).toBe('Hive, Main');
    });

    it('handles @-prefixed usernames', () => {
      const csv = `Title,URL,Username,Password,Notes,Type
Hive,https://hive.blog,@alice,5JVFFWRLwz6JoP9YamGe3N4EoVR3D9Khip5cT6Q8Np5XLQRDESZ,,Login`;

      const accounts = parsePasswordManagerCSV(csv);
      expect(accounts[0].username).toBe('alice');
    });

    it('detects Hive by WIF key in password field', () => {
      const csv = `Title,URL,Username,Password,Notes,Type
Something,https://example.com,dave,5JVFFWRLwz6JoP9YamGe3N4EoVR3D9Khip5cT6Q8Np5XLQRDESZ,,Login`;

      const accounts = parsePasswordManagerCSV(csv);
      expect(accounts).toHaveLength(1);
    });
  });
});
