export interface Agent {
  id: string;
  name: string;
  model: string;
  provider: string;
  status: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  tool: string;
  input?: string;
}

export interface ModelConfig {
  provider: string;
  base_url: string;
  api_key: string;
  model_name: string;
}

export interface BackendStatus {
  healthy: boolean;
  version: string;
}

export interface AgentTemplate {
  name: string;
  description: string;
}

export interface SSEChunk {
  type: 'chunk' | 'tool_use' | 'tool_result' | 'phase' | 'done';
  data: {
    content?: string;
    done?: boolean;
    tool?: string;
    input?: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

export interface AgentListItem {
  id: string;
  name: string;
  model: string;
  provider: string;
  status: string;
}

export type ThemeMode = 'light' | 'dark';

// 知识图谱类型
export interface GraphNode {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  confidence: number;
  properties: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Node3D {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  properties: Record<string, unknown>;
}

export interface OptimizationProgress {
  percent: number;
  message: string;
}
