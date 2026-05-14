import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Typography, Divider } from 'antd';
import {
  MessageOutlined,
  RobotOutlined,
  SettingOutlined,
  NodeIndexOutlined,
  ApiOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const menuItems = [
  {
    key: 'core',
    label: '核心功能',
    type: 'group' as const,
    children: [
      { key: '/', icon: <MessageOutlined />, label: '聊天' },
      { key: '/agents', icon: <RobotOutlined />, label: '智能体' },
      { key: '/knowledge-graph', icon: <NodeIndexOutlined />, label: '知识图谱' },
    ],
  },
  {
    key: 'config',
    label: '配置管理',
    type: 'group' as const,
    children: [
      { key: '/settings', icon: <SettingOutlined />, label: '模型配置' },
    ],
  },
];

const SidebarMenu: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 16px 8px', textAlign: 'center' }}>
        <Text strong style={{ fontSize: 16, display: 'block' }}>
          <ApiOutlined style={{ marginRight: 6, color: '#1677ff' }} />
          OpenFang 管家
        </Text>
      </div>
      <Divider style={{ margin: '0 0 8px' }} />
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        onClick={handleClick}
        items={menuItems}
        style={{ border: 'none', flex: 1 }}
      />
    </div>
  );
};

export default SidebarMenu;
