import React, { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Popconfirm, List, Typography, Tag, Space } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useAgentStore } from '../stores/agentStore';

const { Text } = Typography;

const AgentList: React.FC = () => {
  const {
    agents,
    templates,
    selectedAgentId,
    loading,
    fetchAgents,
    fetchTemplates,
    createAgent,
    deleteAgent,
    selectAgent,
  } = useAgentStore();

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
      setModalOpen(false);
      setNewName('');
      setNewTemplate('assistant');
    } catch {
      // 错误处理由 store 内部完成
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    await deleteAgent(id);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text strong style={{ fontSize: 16 }}>
          智能体列表
        </Text>
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={fetchAgents}
            loading={loading}
          />
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            新建
          </Button>
        </Space>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <List
          dataSource={agents}
          loading={loading}
          locale={{ emptyText: '暂无智能体，点击"新建"创建' }}
          renderItem={(agent) => (
            <List.Item
              onClick={() => selectAgent(agent.id)}
              style={{
                cursor: 'pointer',
                padding: '10px 16px',
                backgroundColor:
                  selectedAgentId === agent.id ? '#e6f4ff' : 'transparent',
                borderLeft:
                  selectedAgentId === agent.id
                    ? '3px solid #1677ff'
                    : '3px solid transparent',
                transition: 'all 0.2s',
              }}
              actions={[
                <Popconfirm
                  key="delete"
                  title="确认删除"
                  description={`确定要删除「${agent.name}」吗？`}
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    handleDelete(agent.id);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                  okText="删除"
                  cancelText="取消"
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <RobotOutlined
                    style={{
                      fontSize: 20,
                      color: selectedAgentId === agent.id ? '#1677ff' : '#999',
                    }}
                  />
                }
                title={
                  <Text
                    strong
                    style={{
                      color: selectedAgentId === agent.id ? '#1677ff' : undefined,
                    }}
                  >
                    {agent.name}
                  </Text>
                }
                description={
                  <Space size={4} wrap>
                    {agent.model && (
                      <Tag color="blue" style={{ fontSize: 11 }}>
                        {agent.model}
                      </Tag>
                    )}
                    {agent.status && (
                      <Tag
                        color={agent.status === 'running' ? 'green' : 'default'}
                        style={{ fontSize: 11 }}
                      >
                        {agent.status === 'running' ? '运行中' : '空闲'}
                      </Tag>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </div>

      <Modal
        title="新建智能体"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setModalOpen(false);
          setNewName('');
        }}
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

export default AgentList;
