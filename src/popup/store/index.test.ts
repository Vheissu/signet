import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './index';

describe('App Store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useStore.setState({
      navStack: [{ page: 'welcome' }],
      currentPage: 'welcome',
      pageParams: {},
      isInitialized: false,
      isLocked: true,
      password: null,
      isLoading: false,
      accounts: [],
      activeAccountName: null,
      activeAccountData: null,
      resources: null,
      globalProperties: null,
      hivePriceUsd: 0,
      hbdPriceUsd: 0,
      toasts: [],
    });
  });

  describe('Navigation', () => {
    it('navigateTo pushes a page onto the stack', () => {
      useStore.getState().navigateTo('dashboard');
      const state = useStore.getState();
      expect(state.currentPage).toBe('dashboard');
      expect(state.navStack).toHaveLength(2);
      expect(state.navStack[1].page).toBe('dashboard');
    });

    it('navigateTo passes params', () => {
      useStore.getState().navigateTo('send', { to: 'alice', amount: '10' });
      const state = useStore.getState();
      expect(state.currentPage).toBe('send');
      expect(state.pageParams).toEqual({ to: 'alice', amount: '10' });
    });

    it('goBack pops the stack', () => {
      useStore.getState().navigateTo('dashboard');
      useStore.getState().navigateTo('send');
      expect(useStore.getState().navStack).toHaveLength(3);

      useStore.getState().goBack();
      const state = useStore.getState();
      expect(state.currentPage).toBe('dashboard');
      expect(state.navStack).toHaveLength(2);
    });

    it('goBack does nothing on the last page', () => {
      useStore.getState().goBack();
      expect(useStore.getState().currentPage).toBe('welcome');
      expect(useStore.getState().navStack).toHaveLength(1);
    });

    it('resetTo replaces the entire stack', () => {
      useStore.getState().navigateTo('dashboard');
      useStore.getState().navigateTo('send');
      useStore.getState().navigateTo('settings');

      useStore.getState().resetTo('login');
      const state = useStore.getState();
      expect(state.currentPage).toBe('login');
      expect(state.navStack).toHaveLength(1);
      expect(state.navStack[0].page).toBe('login');
    });

    it('multiple navigations build the correct stack', () => {
      useStore.getState().navigateTo('dashboard');
      useStore.getState().navigateTo('send');
      useStore.getState().navigateTo('settings');

      const pages = useStore.getState().navStack.map((e) => e.page);
      expect(pages).toEqual(['welcome', 'dashboard', 'send', 'settings']);
    });
  });

  describe('Toasts', () => {
    it('addToast adds a toast with correct properties', () => {
      useStore.getState().addToast('Test message', 'success');
      const toasts = useStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('Test message');
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].id).toBeDefined();
    });

    it('removeToast removes by id', () => {
      useStore.getState().addToast('First', 'info');
      useStore.getState().addToast('Second', 'error');
      const toasts = useStore.getState().toasts;
      expect(toasts).toHaveLength(2);

      useStore.getState().removeToast(toasts[0].id);
      expect(useStore.getState().toasts).toHaveLength(1);
      expect(useStore.getState().toasts[0].message).toBe('Second');
    });

    it('multiple toasts accumulate', () => {
      useStore.getState().addToast('A', 'info');
      useStore.getState().addToast('B', 'success');
      useStore.getState().addToast('C', 'error');
      expect(useStore.getState().toasts).toHaveLength(3);
    });
  });

  describe('Loading state', () => {
    it('setLoading updates loading state and message', () => {
      useStore.getState().setLoading(true, 'Encrypting...');
      expect(useStore.getState().isLoading).toBe(true);
      expect(useStore.getState().loadingMessage).toBe('Encrypting...');
    });

    it('setLoading defaults message to "Loading..."', () => {
      useStore.getState().setLoading(true);
      expect(useStore.getState().loadingMessage).toBe('Loading...');
    });
  });

  describe('Lock state', () => {
    it('lock clears sensitive state', () => {
      useStore.setState({
        isLocked: false,
        password: 'secret',
        accounts: [{ username: 'alice', keys: { posting: 'encrypted' } }],
      });

      useStore.getState().lock();
      const state = useStore.getState();
      expect(state.isLocked).toBe(true);
      expect(state.password).toBeNull();
      expect(state.accounts).toHaveLength(0);
      expect(state.activeAccountData).toBeNull();
      expect(state.currentPage).toBe('login');
    });
  });
});
