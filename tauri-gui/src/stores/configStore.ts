import { create } from 'zustand';
import { configApi, healthApi } from '../services/apiClient';
import { commands } from '../services/tauri_commands';
import type { ModelConfig, BackendStatus, ThemeMode } from '../types';
import { listen } from '@tauri-apps/api/event';

const THEME_KEY = 'openfang-theme';

function loadTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* ignore */ }
  return 'light';
}

function saveTheme(mode: ThemeMode) {
  try { localStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
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
  backendStatus: { healthy: false, version: '未知' },
  themeMode: loadTheme(),
  loading: false,
  saving: false,

  fetchConfig: async () => {
    set({ loading: true });
    try {
      const raw = await configApi.get();
      const dm = (raw.default_model || raw) as Record<string, unknown>;
      set({
        config: {
          provider: (dm.provider as string) || 'ollama',
          base_url: (dm.base_url as string) || 'http://localhost:11434/v1',
          api_key: (dm.api_key as string) || '',
          model_name: (dm.model as string) || 'llama3.2:1b',
        },
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  saveConfig: async (config: ModelConfig) => {
    set({ saving: true });
    try {
      await configApi.set({
        default_model: {
          provider: config.provider,
          base_url: config.base_url,
          api_key: config.api_key,
          model: config.model_name,
        },
      });
      // 重启后端使配置生效
      await commands.restartBackend();
      set({ config, saving: false });
    } catch (err) {
      set({ saving: false });
      throw err;
    }
  },

  checkStatus: async () => {
    try {
      const healthy = await healthApi.check();
      const version = healthy
        ? await healthApi.detail().then((d) => (d.version as string) || '未知').catch(() => '未知')
        : '未知';
      set({ backendStatus: { healthy, version } });
    } catch {
      set({ backendStatus: { healthy: false, version: '未知' } });
    }
  },

  initListener: async () => {
    await listen<string>('backend-status-change', (event) => {
      set((s) => ({
        backendStatus: { ...s.backendStatus, healthy: event.payload === 'running' },
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
