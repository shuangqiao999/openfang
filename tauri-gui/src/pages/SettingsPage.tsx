import React from 'react';
import { Typography, Space } from 'antd';
import SettingsForm from '../components/SettingsForm';
import BackendStatus from '../components/BackendStatus';

const { Title } = Typography;

const SettingsPage: React.FC = () => {
  return (
    <div style={{ padding: 24, height: '100%', maxWidth: 680, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 24 }}>模型配置</Title>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <SettingsForm />
        <BackendStatus />
      </Space>
    </div>
  );
};

export default SettingsPage;
