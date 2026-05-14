import { create } from 'zustand';
import { agentsApi } from '../services/apiClient';
import { commands } from '../services/tauri_commands';
import type { Agent, AgentTemplate } from '../types';

interface AgentStore {
  agents: Agent[];
  templates: AgentTemplate[];
  selectedAgentId: string | null;
  loading: boolean;

  fetchAgents: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  createAgent: (name: string, template: string) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  selectAgent: (id: string) => void;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  templates: [],
  selectedAgentId: null,
  loading: false,

  fetchAgents: async () => {
    set({ loading: true });
    try {
      const raw = await agentsApi.list();
      const agents: Agent[] = raw.map((a) => ({
        id: a.id as string,
        name: a.name as string,
        model: (a.model_name || a.model || '') as string,
        provider: (a.model_provider || a.provider || '') as string,
        status: (a.state || a.status || 'idle') as string,
      }));
      set({ agents, loading: false });
      const { selectedAgentId } = get();
      if (!selectedAgentId && agents.length > 0) {
        set({ selectedAgentId: agents[0].id });
      }
    } catch {
      set({ agents: [], loading: false });
    }
  },

  fetchTemplates: async () => {
    try {
      const templates = await commands.listAgentTemplates();
      set({ templates });
    } catch { /* ignore */ }
  },

  createAgent: async (name: string, template: string) => {
    // 通过 Tauri 加载模板 TOML（需要读取捆绑资源）
    const manifestToml = await commands.loadTemplateToml(name, template);
    await agentsApi.create(manifestToml);
    await get().fetchAgents();
  },

  deleteAgent: async (id: string) => {
    await agentsApi.delete(id);
    const { selectedAgentId } = get();
    if (selectedAgentId === id) {
      const remaining = get().agents.filter((a) => a.id !== id);
      set({ selectedAgentId: remaining.length > 0 ? remaining[0].id : null });
    }
    await get().fetchAgents();
  },

  selectAgent: (id: string) => {
    set({ selectedAgentId: id });
  },
}));
