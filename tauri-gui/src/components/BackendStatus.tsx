import React, { useEffect } from 'react';
import { Card, Button, Space, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useConfigStore } from '../stores/configStore';
import { commands } from '../services/tauri_commands';

const { Text } = Typography;

const BackendStatus: React.FC = () => {
  const { backendStatus, checkStatus, initListener } = useConfigStore();
  const [restarting, setRestarting] = React.useState(false);

  useEffect(() => {
    checkStatus();
    initListener();

    // 定期检查状态
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, [checkStatus, initListener]);

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await commands.restartBackend();
    } catch {
      // 错误已通过事件通知
    }
    setTimeout(() => {
      setRestarting(false);
      checkStatus();
    }, 3000);
  };

  return (
    <Card title="后端状态" style={{ width: '100%', maxWidth: 600 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Space>
            <Text strong>状态：</Text>
            {backendStatus.healthy ? (
              <Tag icon={<CheckCircleOutlined />} color="success">
                运行中
              </Tag>
            ) : (
              <Tag icon={<CloseCircleOutlined />} color="error">
                已停止
              </Tag>
            )}
          </Space>
        </div>

        <div>
          <Text strong>版本：</Text>
          <Text>{backendStatus.version}</Text>
        </div>

        <div>
          <Text strong>端口：</Text>
          <Text code>localhost:4200</Text>
        </div>

        <Button
          icon={<ReloadOutlined />}
          onClick={handleRestart}
          loading={restarting}
        >
          重启后端
        </Button>
      </Space>
    </Card>
  );
};

export default BackendStatus;
