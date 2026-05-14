import React from 'react';
import { Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useConfigStore } from '../stores/configStore';

const BackendStatusIndicator: React.FC = () => {
  const backendStatus = useConfigStore((s) => s.backendStatus);

  return backendStatus.healthy ? (
    <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>
      运行中
    </Tag>
  ) : (
    <Tag icon={<CloseCircleOutlined />} color="error" style={{ margin: 0 }}>
      已停止
    </Tag>
  );
};

export default BackendStatusIndicator;
