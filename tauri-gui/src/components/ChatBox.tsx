import React, { useState, useCallback } from 'react';
import { Input, Button, Dropdown, Typography } from 'antd';
import { SendOutlined, CloseOutlined } from '@ant-design/icons';
import FileAttachment from './FileAttachment';

const { Text } = Typography;

interface ChatBoxProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  streaming?: boolean;
}

const quickCommands = [
  { key: '/run', label: '/run — 运行任务' },
  { key: '/调研', label: '/调研 — 调研分析任务' },
  { key: '/监控', label: '/监控 — 启动监控' },
  { key: '/自动化', label: '/自动化 — 自动化执行' },
  { key: '/hand activate', label: '/hand activate — 激活指定角色' },
];

const ChatBox: React.FC<ChatBoxProps> = ({ onSend, disabled, streaming }) => {
  const [value, setValue] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);

  const buildMessage = useCallback((): string => {
    let msg = value.trim();
    if (attachedFile) {
      const prefix = msg ? `${msg}\n\n` : '';
      msg = `${prefix}[附件: ${attachedFile.name}]\n内容：\n${attachedFile.content.slice(0, 2000)}${attachedFile.content.length > 2000 ? '\n...(已截断)' : ''}`;
    }
    return msg;
  }, [value, attachedFile]);

  const handleSend = useCallback(() => {
    const msg = buildMessage();
    if (!msg || streaming) return;
    onSend(msg);
    setValue('');
    setAttachedFile(null);
  }, [buildMessage, onSend, streaming]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === '/' && value.length === 0) {
        setCommandOpen(true);
      }
    },
    [handleSend, value]
  );

  const handleFileSelect = useCallback((content: string, fileName: string) => {
    setAttachedFile({ name: fileName, content });
  }, []);

  const removeAttachment = useCallback(() => {
    setAttachedFile(null);
  }, []);

  const commandItems = quickCommands.map((cmd) => ({
    key: cmd.key,
    label: cmd.label,
  }));

  const handleCommandSelect = useCallback(
    ({ key }: { key: string }) => {
      setValue(key + ' ');
      setCommandOpen(false);
    },
    []
  );

  return (
    <div className="chat-input-wrapper">
      {attachedFile && (
        <div style={{ marginBottom: 6 }}>
          <span className="attached-file-badge">
            <Text type="secondary" style={{ fontSize: 12 }}>📎</Text>
            <Text style={{ fontSize: 12 }}>{attachedFile.name}</Text>
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={removeAttachment} style={{ padding: 0, fontSize: 10, minWidth: 16, height: 16 }} />
          </span>
        </div>
      )}
      <Dropdown
        menu={{ items: commandItems, onClick: handleCommandSelect }}
        open={commandOpen}
        onOpenChange={setCommandOpen}
        trigger={['click']}
      >
        <Input.TextArea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行。输入 / 选择快捷命令..."
          autoSize={{ minRows: 1, maxRows: 6 }}
          disabled={disabled}
          style={{ resize: 'none' }}
        />
      </Dropdown>

      <div className="chat-input-actions">
        <div className="chat-input-left">
          <FileAttachment onFileSelect={handleFileSelect} disabled={disabled} />
        </div>
        <div className="chat-input-right">
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={disabled || streaming || !buildMessage()}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
