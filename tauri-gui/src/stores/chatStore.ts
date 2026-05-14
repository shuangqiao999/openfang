import { create } from 'zustand';
import { sendMessageStream } from '../services/apiClient';
import type { Message, SSEChunk } from '../types';

let idCounter = 0;
function newId(): string { return `msg_${++idCounter}_${Date.now()}`; }

interface ChatStore {
  messagesByAgent: Record<string, Message[]>;
  streamingAgentId: string | null;
  sendMessage: (agentId: string, content: string) => Promise<void>;
  clearMessages: (agentId: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messagesByAgent: {},
  streamingAgentId: null,

  sendMessage: async (agentId: string, content: string) => {
    const userMsg: Message = { id: newId(), role: 'user', content, timestamp: Date.now() };
    const assistantMsg: Message = { id: newId(), role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true };

    set((s) => {
      const msgs = [...(s.messagesByAgent[agentId] || []), userMsg, assistantMsg];
      return { messagesByAgent: { ...s.messagesByAgent, [agentId]: msgs }, streamingAgentId: agentId };
    });

    try {
      const response = await sendMessageStream(agentId, content);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      let currentData = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6);
          } else if (line === '' && currentEvent) {
            // SSE 事件结束，处理
            const chunk: SSEChunk = { type: currentEvent as SSEChunk['type'], data: {} };

            try {
              const parsed = JSON.parse(currentData);
              if (currentEvent === 'chunk') {
                chunk.data = { content: parsed.content || '', done: parsed.done || false };
              } else if (currentEvent === 'tool_use') {
                chunk.data = { tool: parsed.tool || '' };
              } else if (currentEvent === 'done') {
                chunk.data = { done: true, usage: parsed.usage };
              } else {
                chunk.data = parsed;
              }
            } catch {
              chunk.data = { content: currentData };
            }

            set((s) => {
              const msgs = [...(s.messagesByAgent[agentId] || [])];
              const last = { ...msgs[msgs.length - 1] };
              if (chunk.type === 'chunk' && chunk.data.content) {
                last.content += chunk.data.content;
              } else if (chunk.type === 'tool_use') {
                last.content += `\n\n🔧 **工具**: ${chunk.data.tool || '未知'}\n`;
              } else if (chunk.type === 'done') {
                last.isStreaming = false;
              }
              msgs[msgs.length - 1] = last;
              return {
                messagesByAgent: { ...s.messagesByAgent, [agentId]: msgs },
                streamingAgentId: chunk.type === 'done' ? null : s.streamingAgentId,
              };
            });

            currentEvent = '';
            currentData = '';
          }
        }
      }

      // 流结束但未收到 done
      set((s) => {
        const msgs = [...(s.messagesByAgent[agentId] || [])];
        if (msgs.length > 0) {
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], isStreaming: false };
        }
        return { messagesByAgent: { ...s.messagesByAgent, [agentId]: msgs }, streamingAgentId: null };
      });
    } catch (err) {
      console.error('Stream error:', err);
      set((s) => {
        const msgs = [...(s.messagesByAgent[agentId] || [])];
        if (msgs.length > 0) {
          const last = { ...msgs[msgs.length - 1], isStreaming: false };
          last.content += '\n\n❌ 消息发送失败，请检查后端是否运行。';
          msgs[msgs.length - 1] = last;
        }
        return { messagesByAgent: { ...s.messagesByAgent, [agentId]: msgs }, streamingAgentId: null };
      });
    }
  },

  clearMessages: (agentId: string) => {
    set((s) => ({ messagesByAgent: { ...s.messagesByAgent, [agentId]: [] } }));
  },
}));
