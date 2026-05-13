import { create } from 'zustand';
import { commands } from '../services/tauri_commands';
import type { ModelConfig, BackendStatus, ThemeMode } from '../types';
import { listen } from '@tauri-apps/api/event';

const THEME_KEY = 'openfang-theme';

// 从 localStorage 读取主题偏好
function loadTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* ignore */ }
  return 'light';
}

// 持久化主题到 localStorage
function saveTheme(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch { /* ignore */ }
}

interface ConfigStore {
  config: ModelConfig;
  backendStatus: BackendStatus;
  themeMode: ThemeMode;
  loading: boolean;
  saving: boolean;

  fetchConfig: () => Promise<void>;
  saveConfig: (config: ModelConfig) => Promise<void>;
  checkStatus: () => Promise<void>;
  initListener: () => Promise<void>;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: {
    provider: 'ollama',
    base_url: 'http://localhost:11434/v1',
    api_key: '',
    model_name: 'llama3.2:1b',
  },
  backendStatus: {
    healthy: false,
    version: '未知',
  },
  themeMode: loadTheme(),
  loading: false,
  saving: false,

  fetchConfig: async () => {
    set({ loading: true });
    try {
      const cfg = await commands.getConfig();
      set({ config: cfg, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  saveConfig: async (config: ModelConfig) => {
    set({ saving: true });
    try {
      await commands.setConfig(config);
      set({ config, saving: false });
    } catch (err) {
      set({ saving: false });
      throw err;
    }
  },

  checkStatus: async () => {
    try {
      const status = await commands.getBackendStatus();
      set({ backendStatus: status });
    } catch {
      set({ backendStatus: { healthy: false, version: '未知' } });
    }
  },

  initListener: async () => {
    await listen<string>('backend-status-change', (event) => {
      const status = event.payload;
      set((state) => ({
        backendStatus: {
          ...state.backendStatus,
          healthy: status === 'running',
        },
      }));
    });
  },

  toggleTheme: () => {
    const next = get().themeMode === 'light' ? 'dark' : 'light';
    saveTheme(next);
    set({ themeMode: next });
  },

  setTheme: (mode: ThemeMode) => {
    saveTheme(mode);
    set({ themeMode: mode });
  },
}));
