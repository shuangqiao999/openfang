import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useConfigStore } from './stores/configStore';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import './App.css';

const App: React.FC = () => {
  const themeMode = useConfigStore((s) => s.themeMode);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm:
          themeMode === 'dark'
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
        token: {
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif",
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
