import { create } from 'zustand';
import { commands } from '../services/tauri_commands';
import { listenToStream } from '../services/stream_handler';
import type { Message, SSEChunk } from '../types';
import type { UnlistenFn } from '@tauri-apps/api/event';

let unlistenFn: UnlistenFn | null = null;
let idCounter = 0;

function newId(): string {
  return `msg_${++idCounter}_${Date.now()}`;
}

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
    const userMsg: Message = {
      id: newId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const assistantMsg: Message = {
      id: newId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    // 添加用户消息和空的 AI 回复
    set((state) => {
      const existing = state.messagesByAgent[agentId] || [];
      return {
        messagesByAgent: {
          ...state.messagesByAgent,
          [agentId]: [...existing, userMsg, assistantMsg],
        },
        streamingAgentId: agentId,
      };
    });

    // 取消之前的监听
    if (unlistenFn) {
      unlistenFn();
      unlistenFn = null;
    }

    // 设置 SSE 事件监听
    unlistenFn = await listenToStream(
      (chunk: SSEChunk) => {
        set((state) => {
          const msgs = [...(state.messagesByAgent[agentId] || [])];
          const lastIdx = msgs.length - 1;
          if (lastIdx < 0) return state;

          const last = { ...msgs[lastIdx] };

          if (chunk.type === 'chunk' && chunk.data.content) {
            last.content += chunk.data.content;
          } else if (chunk.type === 'tool_use') {
            const toolName = chunk.data.tool || '未知工具';
            last.content += `\n\n🔧 **调用工具**: ${toolName}\n`;
            last.toolCalls = [...(last.toolCalls || []), { tool: toolName }];
          } else if (chunk.type === 'tool_result') {
            // 工具结果不额外展示，由 AI 在回复中说明
          } else if (chunk.type === 'done') {
            last.isStreaming = false;
          }

          msgs[lastIdx] = last;

          return {
            messagesByAgent: {
              ...state.messagesByAgent,
              [agentId]: msgs,
            },
            streamingAgentId: chunk.type === 'done' ? null : state.streamingAgentId,
          };
        });
      },
      () => {
        // 完成回调
        set((state) => {
          const msgs = [...(state.messagesByAgent[agentId] || [])];
          const lastIdx = msgs.length - 1;
          if (lastIdx >= 0) {
            const last = { ...msgs[lastIdx], isStreaming: false };
            msgs[lastIdx] = last;
          }
          return {
            messagesByAgent: {
              ...state.messagesByAgent,
              [agentId]: msgs,
            },
            streamingAgentId: null,
          };
        });
      }
    );

    // 发送消息
    try {
      await commands.sendMessageStream(agentId, content);
    } catch (err) {
      console.error('发送消息失败:', err);
      set((state) => {
        const msgs = [...(state.messagesByAgent[agentId] || [])];
        const lastIdx = msgs.length - 1;
        if (lastIdx >= 0) {
          const last = {
            ...msgs[lastIdx],
            content: msgs[lastIdx].content + '\n\n❌ 消息发送失败，请检查后端是否正常运行。',
            isStreaming: false,
          };
          msgs[lastIdx] = last;
        }
        return {
          messagesByAgent: {
            ...state.messagesByAgent,
            [agentId]: msgs,
          },
          streamingAgentId: null,
        };
      });
    }
  },

  clearMessages: (agentId: string) => {
    set((state) => ({
      messagesByAgent: {
        ...state.messagesByAgent,
        [agentId]: [],
      },
    }));
  },
}));
