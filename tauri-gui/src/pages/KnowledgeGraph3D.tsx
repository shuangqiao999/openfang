//! 知识图谱 3D 可视化页面
//! 从左下角菜单进入，展示实体-关系的力导向 3D 图，支持 LLM 审查与去重。

import React, { useEffect, useState, useCallback } from 'react';
import { Layout, Button, Space, Typography, Progress, message, Dropdown } from 'antd';
import {
  ReloadOutlined,
  ExportOutlined,
  ThunderboltOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import Graph3DScene from '../components/Graph3DScene';
import type { GraphNodeR3F } from '../components/Graph3DScene';
import NodeDetailsModal from '../components/NodeDetailsModal';
import { commands } from '../services/tauri_commands';
import type { GraphData, OptimizationProgress } from '../types';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const KnowledgeGraph3D: React.FC = () => {
  const navigate = useNavigate();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNodeR3F | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // LLM 优化状态
  const [optimizing, setOptimizing] = useState(false);
  const [progress, setProgress] = useState<OptimizationProgress>({ percent: 0, message: '' });

  // 加载图谱数据
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await commands.getKnowledgeGraphData();
      setGraphData(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 监听优化进度
  useEffect(() => {
    const unlisten = listen<OptimizationProgress>('optimization-progress', (event) => {
      setProgress(event.payload);
    });
    const unlistenDone = listen<{ success: boolean; message: string }>(
      'optimization-complete',
      (event) => {
        setOptimizing(false);
        if (event.payload.success) {
          message.success('知识库优化完成，正在刷新图谱...');
          loadData();
        } else {
          message.error(`优化失败: ${event.payload.message}`);
        }
      }
    );
    return () => {
      unlisten.then((fn) => fn());
      unlistenDone.then((fn) => fn());
    };
  }, [loadData]);

  // 处理节点点击
  const handleNodeClick = useCallback((node: GraphNodeR3F) => {
    setSelectedNode(node);
    setModalOpen(true);
  }, []);

  // 启动 LLM 优化
  const handleOptimize = async () => {
    setOptimizing(true);
    setProgress({ percent: 0, message: '正在启动...' });
    try {
      await commands.startKnowledgeOptimization();
    } catch (err) {
      setOptimizing(false);
      message.error(`启动优化失败: ${err}`);
    }
  };

  // 导出 JSON
  const handleExport = () => {
    if (!graphData) return;
    const json = JSON.stringify(graphData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge-graph-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('图谱数据已导出');
  };

  return (
    <Layout style={{ height: '100vh', background: '#0a0a1a' }}>
      <Header
        style={{
          background: 'rgba(10,10,26,0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 48,
          backdropFilter: 'blur(8px)',
        }}
      >
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            style={{ color: '#fff' }}
          >
            返回
          </Button>
          <Title level={5} style={{ color: '#fff', margin: 0 }}>
            知识图谱
          </Title>
          {graphData && (
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              {graphData.nodes.length} 实体 · {graphData.edges.length} 关系
            </Text>
          )}
        </Space>

        <Space>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={handleOptimize}
            loading={optimizing}
            style={{ background: '#722ed1', color: '#fff', border: 'none' }}
          >
            LLM 审查与去重
          </Button>
          <Dropdown
            menu={{
              items: [
                { key: 'export', label: '导出 JSON', icon: <ExportOutlined />, onClick: handleExport },
                { key: 'refresh', label: '刷新数据', icon: <ReloadOutlined />, onClick: loadData },
              ],
            }}
          >
            <Button icon={<ExportOutlined />} style={{ color: '#fff', background: 'transparent' }}>
              更多
            </Button>
          </Dropdown>
        </Space>
      </Header>

      <Content style={{ position: 'relative', flex: 1 }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              background: 'rgba(10,10,26,0.7)',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 18 }}>加载知识图谱数据...</Text>
          </div>
        )}

        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 12,
              zIndex: 10,
            }}
          >
            <Text style={{ color: '#ff4d4f', fontSize: 16 }}>{error}</Text>
            <Button onClick={loadData} type="primary">
              重试
            </Button>
          </div>
        )}

        {graphData && graphData.nodes.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>
              知识库暂无实体数据，请先使用 Agent 积累知识
            </Text>
          </div>
        )}

        {graphData && graphData.nodes.length > 0 && (
          <Graph3DScene data={graphData} onNodeClick={handleNodeClick} />
        )}

        {/* 优化进度条 */}
        {optimizing && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 400,
              background: 'rgba(0,0,0,0.85)',
              borderRadius: 12,
              padding: '12px 20px',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13, marginBottom: 8, display: 'block' }}>
              {progress.message}
            </Text>
            <Progress percent={progress.percent} size="small" strokeColor="#722ed1" />
          </div>
        )}
      </Content>

      <NodeDetailsModal
        open={modalOpen}
        node={selectedNode}
        graphData={graphData}
        onClose={() => setModalOpen(false)}
      />
    </Layout>
  );
};

export default KnowledgeGraph3D;
