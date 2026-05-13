import { create } from 'zustand';
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
      const result = await commands.listAgents();
      const list = result as { agents?: Record<string, unknown>[] };
      const agents = (list?.agents || []) as Record<string, unknown>[];
      set({
        agents: agents.map((a) => ({
          id: a.id as string,
          name: a.name as string,
          model: (a.model || a.default_model || '') as string,
          provider: (a.provider || '') as string,
          status: (a.status || 'idle') as string,
        })),
        loading: false,
      });
    } catch {
      set({ agents: [], loading: false });
    }
  },

  fetchTemplates: async () => {
    try {
      const templates = await commands.listAgentTemplates();
      set({ templates });
    } catch {
      // 忽略
    }
  },

  createAgent: async (name: string, template: string) => {
    await commands.createAgent(name, template);
    await get().fetchAgents();
  },

  deleteAgent: async (id: string) => {
    await commands.deleteAgent(id);
    const { selectedAgentId } = get();
    if (selectedAgentId === id) {
      set({ selectedAgentId: null });
    }
    await get().fetchAgents();
  },

  selectAgent: (id: string) => {
    set({ selectedAgentId: id });
  },
}));
