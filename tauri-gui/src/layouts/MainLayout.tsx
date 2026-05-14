import React, { useEffect } from 'react';
import { Layout, Typography, Space, Button, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Outlet } from 'react-router-dom';
import SidebarMenu from '../components/SidebarMenu';
import ThemeToggle from '../components/ThemeToggle';
import BackendStatusIndicator from '../components/BackendStatusIndicator';
import { useAgentStore } from '../stores/agentStore';
import { useConfigStore } from '../stores/configStore';
import '../styles/global.css';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MainLayout: React.FC = () => {
  const { selectedAgentId, fetchAgents } = useAgentStore();
  const { checkStatus, initListener } = useConfigStore();
  const agents = useAgentStore((s) => s.agents);

  useEffect(() => {
    fetchAgents();
    checkStatus();
    initListener();

    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchAgents, checkStatus, initListener]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        width={240}
        style={{
          background: 'var(--ant-color-bg-container)',
          borderRight: '1px solid var(--ant-color-border-secondary)',
          overflow: 'auto',
        }}
      >
        <SidebarMenu />
      </Sider>

      <Layout>
        <Header
          style={{
            background: 'var(--ant-color-bg-container)',
            borderBottom: '1px solid var(--ant-color-border-secondary)',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 48,
          }}
        >
          <Space>
            <BackendStatusIndicator />
            {selectedAgent && (
              <Text strong style={{ fontSize: 14 }}>
                {selectedAgent.name}
              </Text>
            )}
          </Space>

          <Space size={12}>
            <Tooltip title="刷新后端状态">
              <Button type="text" size="small" icon={<ReloadOutlined />} onClick={checkStatus} />
            </Tooltip>
            <ThemeToggle />
          </Space>
        </Header>

        <Content
          style={{
            background: 'var(--ant-color-bg-layout)',
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
