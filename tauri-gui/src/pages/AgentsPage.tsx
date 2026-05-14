//! 智能体管理页面 — 表格展示、创建、删除
import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Input, Select, Space, Tag, Popconfirm, Typography, message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, RobotOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAgentStore } from '../stores/agentStore';
import type { Agent } from '../types';

const { Text } = Typography;

const AgentsPage: React.FC = () => {
  const { agents, templates, loading, fetchAgents, fetchTemplates, createAgent, deleteAgent, selectAgent } =
    useAgentStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTemplate, setNewTemplate] = useState('assistant');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchAgents();
    fetchTemplates();
  }, [fetchAgents, fetchTemplates]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createAgent(newName.trim(), newTemplate);
      message.success(`智能体「${newName}」创建成功`);
      setModalOpen(false);
      setNewName('');
      setNewTemplate('assistant');
    } catch (err) {
      message.error(`创建失败: ${err}`);
    }
    setCreating(false);
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteAgent(id);
      message.success(`已删除「${name}」`);
    } catch (err) {
      message.error(`删除失败: ${err}`);
    }
  };

  const columns: ColumnsType<Agent> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, _record: Agent) => (
        <Space>
          <RobotOutlined style={{ color: '#1677ff' }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
      render: (model: string) => model ? <Tag color="blue">{model}</Tag> : <Tag>默认</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) =>
        status === 'running' ? <Tag color="green">运行中</Tag> : <Tag>空闲</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: Agent) => (
        <Space>
          <Popconfirm
            title="确认删除"
            description={`确定要删除「${record.name}」吗？`}
            onConfirm={() => handleDelete(record.id, record.name)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, height: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Text strong style={{ fontSize: 18 }}>
          智能体管理
        </Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAgents} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            新建智能体
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={agents}
        rowKey="id"
        loading={loading}
        locale={{ emptyText: '暂无智能体，点击右上角新建' }}
        size="middle"
        onRow={(record) => ({
          onClick: () => selectAgent(record.id),
          style: { cursor: 'pointer' },
        })}
      />

      <Modal
        title="新建智能体"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => { setModalOpen(false); setNewName(''); }}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Text>智能体名称</Text>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="输入智能体名称"
            style={{ marginTop: 4 }}
            onPressEnter={handleCreate}
          />
        </div>
        <div>
          <Text>选择模板</Text>
          <Select
            value={newTemplate}
            onChange={setNewTemplate}
            style={{ width: '100%', marginTop: 4 }}
            options={templates.map((t) => ({
              label: `${t.name} — ${t.description}`,
              value: t.name,
            }))}
          />
        </div>
      </Modal>
    </div>
  );
};

export default AgentsPage;
