import React from 'react';
import { Layout, Typography, Button, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import SettingsForm from '../components/SettingsForm';
import BackendStatus from '../components/BackendStatus';

const { Content, Header } = Layout;
const { Title } = Typography;

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout style={{ height: '100vh', backgroundColor: '#f5f5f5' }}>
      <Header
        style={{
          backgroundColor: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          height: 48,
        }}
      >
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
        >
          返回
        </Button>
        <Title level={5} style={{ margin: '0 0 0 16px' }}>
          设置
        </Title>
      </Header>

      <Content
        style={{
          padding: 24,
          maxWidth: 680,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <SettingsForm />
          <BackendStatus />
        </Space>
      </Content>
    </Layout>
  );
};

export default SettingsPage;
