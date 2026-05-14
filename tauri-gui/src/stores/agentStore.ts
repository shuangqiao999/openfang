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
      // API 返回直接数组 [{"id":"...","name":"...","state":"Running",...}]
      // 也兼容 { agents: [...] } 格式
      const raw = (
        Array.isArray(result) ? result : (result as Record<string, unknown>)?.agents || []
      ) as Record<string, unknown>[];
      const agents: Agent[] = raw.map((a) => ({
        id: a.id as string,
        name: a.name as string,
        model: (a.model_name || a.model || '') as string,
        provider: (a.model_provider || a.provider || '') as string,
        status: (a.state || a.status || 'idle') as string,
      }));
      set({ agents, loading: false });

      // 自动选中第一个 Agent（如果尚未选中）
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
      // 删除前选中下一个 Agent
      const remaining = get().agents.filter((a) => a.id !== id);
      set({ selectedAgentId: remaining.length > 0 ? remaining[0].id : null });
    }
    await get().fetchAgents();
  },

  selectAgent: (id: string) => {
    set({ selectedAgentId: id });
  },
}));
