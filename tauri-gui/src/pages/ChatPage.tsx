import React, { useEffect, useRef } from 'react';
import { Layout, Typography, Button, Space } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AgentList from '../components/AgentList';
import ChatBox from '../components/ChatBox';
import MessageBubble from '../components/MessageBubble';
import ThemeToggle from '../components/ThemeToggle';
import { useAgentStore } from '../stores/agentStore';
import { useChatStore } from '../stores/chatStore';

const { Sider, Content, Header } = Layout;
const { Text } = Typography;

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { agents, selectedAgentId } = useAgentStore();
  const { messagesByAgent, streamingAgentId, sendMessage } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const messages = selectedAgentId ? messagesByAgent[selectedAgentId] || [] : [];
  const isStreaming = streamingAgentId === selectedAgentId;

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (content: string) => {
    if (!selectedAgentId || !content.trim()) return;
    await sendMessage(selectedAgentId, content);
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        width={280}
        style={{
          backgroundColor: '#fff',
          borderRight: '1px solid #f0f0f0',
          overflow: 'auto',
        }}
      >
        <AgentList />
      </Sider>

      <Layout>
        <Header
          style={{
            backgroundColor: '#fff',
            borderBottom: '1px solid #f0f0f0',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 48,
          }}
        >
          <Text strong style={{ fontSize: 16 }}>
            {selectedAgent ? selectedAgent.name : '选择一个智能体开始对话'}
          </Text>
          <Space>
            <ThemeToggle />
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => navigate('/settings')}
            >
              设置
            </Button>
          </Space>
        </Header>

        <Content
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 48px)',
          }}
        >
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px 0',
              backgroundColor: '#fafafa',
            }}
          >
            {!selectedAgentId ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <Text type="secondary" style={{ fontSize: 18 }}>
                  👈 请从左侧选择一个智能体开始对话
                </Text>
              </div>
            ) : messages.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <Space direction="vertical" align="center">
                  <Text type="secondary" style={{ fontSize: 24 }}>
                    🤖
                  </Text>
                  <Text type="secondary">
                    发送第一条消息开始与「{selectedAgent?.name}」对话
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    提示：输入 / 可使用快捷命令
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
        </Content>
      </Layout>
    </Layout>
  );
};

export default ChatPage;
