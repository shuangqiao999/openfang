import { invoke } from '@tauri-apps/api/core';
import type { ModelConfig, AgentTemplate, BackendStatus } from '../types';

export const commands = {
  // 后端管理
  startBackend: () => invoke<string>('start_backend'),
  stopBackend: () => invoke<string>('stop_backend'),
  restartBackend: () => invoke<string>('restart_backend'),
  getBackendStatus: () => invoke<BackendStatus>('get_backend_status'),

  // 配置管理
  getConfig: () => invoke<ModelConfig>('get_config'),
  setConfig: (config: ModelConfig) => invoke<string>('set_config', { cfg: config }),

  // Agent 管理
  listAgents: () => invoke<unknown>('list_agents'),
  createAgent: (name: string, template: string) =>
    invoke<unknown>('create_agent', { name, template }),
  deleteAgent: (agentId: string) => invoke<unknown>('delete_agent', { agentId }),

  // Agent 模板
  listAgentTemplates: () => invoke<AgentTemplate[]>('list_agent_templates'),

  // 流式消息
  sendMessageStream: (agentId: string, message: string) =>
    invoke<void>('send_message_stream', { agentId, message }),
};
