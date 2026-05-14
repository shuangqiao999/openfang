//! 统一 HTTP 客户端 — 直接与 OpenFang 子进程 API 通信 (localhost:4200)
//! 替代原来的 Tauri invoke 代理模式，简化通信链路。

const BASE = 'http://localhost:4200/api';

export async function apiRequest<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '未知错误');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Agent 管理
export const agentsApi = {
  list: () => apiRequest<Record<string, unknown>[]>('/agents'),
  create: (manifestToml: string) =>
    apiRequest<Record<string, unknown>>('/agents', {
      method: 'POST',
      body: JSON.stringify({ manifest_toml: manifestToml }),
    }),
  delete: (id: string) => apiRequest<Record<string, unknown>>(`/agents/${id}`, { method: 'DELETE' }),
};

// 配置管理
export const configApi = {
  get: () => apiRequest<Record<string, unknown>>('/config'),
  set: (cfg: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>('/config/set', {
      method: 'POST',
      body: JSON.stringify(cfg),
    }),
};

// 健康检查
export const healthApi = {
  check: async (): Promise<boolean> => {
    try {
      const res = await fetch('http://localhost:4200/api/health');
      return res.ok;
    } catch {
      return false;
    }
  },
  detail: () => apiRequest<Record<string, unknown>>('/health/detail'),
};

// 流式消息 (SSE) — 返回 ReadableStream 供逐块读取
export function sendMessageStream(agentId: string, message: string): Promise<Response> {
  return fetch(`${BASE}/agents/${agentId}/message/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
}

// 同步消息
export const messageApi = {
  send: (agentId: string, message: string) =>
    apiRequest<Record<string, unknown>>(`/agents/${agentId}/message`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};
