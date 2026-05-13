import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Avatar, Typography, Spin } from 'antd';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import type { Message } from '../types';

const { Text } = Typography;

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
        padding: '0 16px',
      }}
    >
      <Avatar
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        style={{
          backgroundColor: isUser ? '#1677ff' : '#52c41a',
          flexShrink: 0,
        }}
      />

      <div
        style={{
          maxWidth: '75%',
          marginLeft: isUser ? 0 : 8,
          marginRight: isUser ? 8 : 0,
          padding: '10px 14px',
          borderRadius: 12,
          backgroundColor: isUser ? '#e6f4ff' : '#f6f6f6',
          border: isUser ? '1px solid #91caff' : '1px solid #e8e8e8',
        }}
      >
        {message.content ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeStr = String(children).replace(/\n$/, '');
                const inline = !match;
                // Check if we're inside a code block by looking at the node type
                const nodeProps = props as Record<string, unknown>;
                const node = nodeProps.node as { tagName?: string } | undefined;

                if (!inline && match && node?.tagName === 'code') {
                  return (
                    <SyntaxHighlighter
                      style={oneLight}
                      language={match[1]}
                      PreTag="div"
                    >
                      {codeStr}
                    </SyntaxHighlighter>
                  );
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        ) : message.isStreaming ? (
          <Text type="secondary">
            思考中
            <Spin size="small" style={{ marginLeft: 8 }} />
          </Text>
        ) : (
          <Text type="secondary">空回复</Text>
        )}

        {message.isStreaming && message.content && (
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 16,
              backgroundColor: '#1677ff',
              marginLeft: 2,
              animation: 'blink 1s step-end infinite',
            }}
          />
        )}

        <div style={{ marginTop: 4, textAlign: 'right' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
