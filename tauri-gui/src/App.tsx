import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntApp, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useConfigStore } from './stores/configStore';
import MainLayout from './layouts/MainLayout';
import ChatPage from './pages/ChatPage';
import AgentsPage from './pages/AgentsPage';
import SettingsPage from './pages/SettingsPage';
import KnowledgeGraph3D from './pages/KnowledgeGraph3D';
import './App.css';

const App: React.FC = () => {
  const themeMode = useConfigStore((s) => s.themeMode);
  const { fetchConfig, initListener } = useConfigStore();

  useEffect(() => {
    fetchConfig();
    initListener();
  }, [fetchConfig, initListener]);

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
          borderRadius: 8,
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<ChatPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/knowledge-graph" element={<KnowledgeGraph3D />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
