import React, { useState, useCallback } from 'react';
import { Input, Button, Space, Dropdown } from 'antd';
import { SendOutlined } from '@ant-design/icons';

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

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || streaming) return;
    onSend(trimmed);
    setValue('');
  }, [value, onSend, streaming]);

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

  const handleCommandSelect = useCallback(
    ({ key }: { key: string }) => {
      setValue(key + ' ');
      setCommandOpen(false);
    },
    []
  );

  const commandItems = quickCommands.map((cmd) => ({
    key: cmd.key,
    label: cmd.label,
  }));

  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
      <Dropdown
        menu={{ items: commandItems, onClick: handleCommandSelect }}
        open={commandOpen}
        onOpenChange={setCommandOpen}
        trigger={['click']}
      >
        <Space.Compact style={{ width: '100%' }}>
          <Input.TextArea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行。输入 / 选择快捷命令..."
            autoSize={{ minRows: 1, maxRows: 6 }}
            disabled={disabled}
            style={{ resize: 'none' }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={disabled || streaming || !value.trim()}
            style={{ height: 'auto' }}
          >
            发送
          </Button>
        </Space.Compact>
      </Dropdown>
    </div>
  );
};

export default ChatBox;
