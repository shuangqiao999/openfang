import React from 'react';
import { Switch, Space } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useConfigStore } from '../stores/configStore';

const ThemeToggle: React.FC = () => {
  const { themeMode, toggleTheme } = useConfigStore();
  const isDark = themeMode === 'dark';

  return (
    <Space>
      <SunOutlined style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#faad14' }} />
      <Switch
        checked={isDark}
        onChange={toggleTheme}
        checkedChildren={<MoonOutlined />}
        unCheckedChildren={<SunOutlined />}
        size="small"
      />
      <MoonOutlined style={{ color: isDark ? '#597ef7' : 'rgba(0,0,0,0.25)' }} />
    </Space>
  );
};

export default ThemeToggle;
