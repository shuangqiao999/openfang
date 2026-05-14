import { invoke } from '@tauri-apps/api/core';
import type { AgentTemplate, GraphData } from '../types';

export const commands = {
  // 后端进程管理（仅保留系统级操作）
  startBackend: () => invoke<string>('start_backend'),
  stopBackend: () => invoke<string>('stop_backend'),
  restartBackend: () => invoke<string>('restart_backend'),

  // Agent 模板（需要读取捆绑资源文件）
  listAgentTemplates: () => invoke<AgentTemplate[]>('list_agent_templates'),
  loadTemplateToml: (name: string, template: string) =>
    invoke<string>('load_template_toml', { name, template }),

  // 知识图谱（需要 SQLite 访问）
  getKnowledgeGraphData: () => invoke<GraphData>('get_knowledge_graph_data'),
  startKnowledgeOptimization: () => invoke<void>('start_knowledge_optimization'),

  // 模型列表拉取（需要代理外部 API）
  fetchModels: (provider: string, baseUrl: string, apiKey?: string) =>
    invoke<string[]>('fetch_models', { provider, baseUrl, apiKey }),
};
