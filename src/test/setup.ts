import '@testing-library/jest-dom';
import { Buffer } from 'buffer';

(globalThis as any).Buffer = Buffer;

// Mock chrome.storage for tests
const storageData: Record<string, any> = {};

(globalThis as any).chrome = {
  storage: {
    local: {
      get: async (keys: string | string[]) => {
        const result: Record<string, any> = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) result[k] = storageData[k];
        return result;
      },
      set: async (items: Record<string, any>) => {
        Object.assign(storageData, items);
      },
      remove: async (keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) delete storageData[k];
      },
      clear: async () => {
        Object.keys(storageData).forEach((k) => delete storageData[k]);
      },
    },
    session: {
      get: async (keys: string | string[]) => {
        const result: Record<string, any> = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) result[k] = storageData[`_session_${k}`];
        return result;
      },
      set: async (items: Record<string, any>) => {
        for (const [k, v] of Object.entries(items)) storageData[`_session_${k}`] = v;
      },
      remove: async (keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) delete storageData[`_session_${k}`];
      },
      clear: async () => {
        Object.keys(storageData)
          .filter((k) => k.startsWith('_session_'))
          .forEach((k) => delete storageData[k]);
      },
    },
  },
  runtime: {
    sendMessage: async () => ({}),
    getURL: (path: string) => `chrome-extension://test/${path}`,
  },
  alarms: {
    create: () => {},
  },
  idle: {
    queryState: async () => 'active',
  },
};
