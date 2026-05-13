import { create } from 'zustand';
import { commands } from '../services/tauri_commands';
import type { ModelConfig, BackendStatus } from '../types';
import { listen } from '@tauri-apps/api/event';

interface ConfigStore {
  config: ModelConfig;
  backendStatus: BackendStatus;
  loading: boolean;
  saving: boolean;

  fetchConfig: () => Promise<void>;
  saveConfig: (config: ModelConfig) => Promise<void>;
  checkStatus: () => Promise<void>;
  initListener: () => Promise<void>;
}

export const useConfigStore = create<ConfigStore>((set) => ({
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
}));
