//! 聊天页面 — 无侧边栏，由 MainLayout 提供外框
import React, { useEffect, useRef, useState } from 'react';
import { Typography, Space, Button, message as antMsg } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import ChatBox from '../components/ChatBox';
import MessageBubble from '../components/MessageBubble';
import AgentList from '../components/AgentList';
import { useAgentStore } from '../stores/agentStore';
import { useChatStore } from '../stores/chatStore';

const { Text } = Typography;

const ChatPage: React.FC = () => {
  const { selectedAgentId, agents } = useAgentStore();
  const { messagesByAgent, streamingAgentId, sendMessage } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showAgentList, setShowAgentList] = useState(true);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const messages = selectedAgentId ? messagesByAgent[selectedAgentId] || [] : [];
  const isStreaming = streamingAgentId === selectedAgentId;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (content: string) => {
    if (!selectedAgentId || !content.trim()) return;
    try {
      await sendMessage(selectedAgentId, content);
    } catch {
      antMsg.error('发送失败，请检查后端状态');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* 内嵌 Agent 列表（可折叠） */}
      {showAgentList && (
        <div
          style={{
            width: 280,
            flexShrink: 0,
            borderRight: '1px solid var(--ant-color-border-secondary)',
            background: 'var(--ant-color-bg-container)',
          }}
        >
          <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="text" size="small" onClick={() => setShowAgentList(false)}>
              收起
            </Button>
          </div>
          <AgentList />
        </div>
      )}

      {/* 聊天主区域 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 0',
          }}
        >
          {!selectedAgentId ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Space direction="vertical" align="center" size={8}>
                <RobotOutlined style={{ fontSize: 48, opacity: 0.3 }} />
                <Text type="secondary" style={{ fontSize: 16 }}>
                  选择一个智能体开始对话
                </Text>
                {!showAgentList && (
                  <Button type="link" onClick={() => setShowAgentList(true)}>
                    展开智能体列表
                  </Button>
                )}
              </Space>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Space direction="vertical" align="center">
                <Text style={{ fontSize: 36, opacity: 0.5 }}>🤖</Text>
                <Text type="secondary">
                  发送第一条消息开始与「{selectedAgent?.name}」对话
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  输入 / 可使用快捷命令
                </Text>
              </Space>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <ChatBox
          onSend={handleSend}
          disabled={!selectedAgentId}
          streaming={isStreaming}
        />
      </div>
    </div>
  );
};

export default ChatPage;
