import React, { useEffect, useState } from 'react';
import { Form, Input, Select, Button, Card, Space, message, Modal, List, Typography } from 'antd';
import { SaveOutlined, DownloadOutlined } from '@ant-design/icons';
import { useConfigStore } from '../stores/configStore';
import { commands } from '../services/tauri_commands';

const { Text } = Typography;

const providerOptions = [
  { label: 'Ollama (本地)', value: 'ollama' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'OpenAI 兼容 (本地)', value: 'openai_compatible' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Groq', value: 'groq' },
];

// 预设地址：切换提供商时自动填充
const providerDefaults: Record<string, { baseUrl: string; hint: string }> = {
  ollama: { baseUrl: 'http://localhost:11434/v1', hint: 'Ollama 默认端口 11434' },
  openai: { baseUrl: 'https://api.openai.com/v1', hint: '使用 OpenAI API Key 认证' },
  openai_compatible: { baseUrl: 'http://localhost:1234/v1', hint: '如 LM Studio / vLLM / LocalAI 等' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', hint: '使用 Anthropic API Key 认证' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', hint: '使用 Groq API Key 认证' },
};

// 支持拉取模型列表的提供商
const FETCHABLE_PROVIDERS = ['ollama', 'openai', 'openai_compatible', 'groq'];

const SettingsForm: React.FC = () => {
  const { config, saving, fetchConfig, saveConfig } = useConfigStore();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // 模型列表拉取状态
  const [modelList, setModelList] = useState<string[]>([]);
  const [modelListVisible, setModelListVisible] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    form.setFieldsValue({
      provider: config.provider,
      base_url: config.base_url,
      api_key: config.api_key,
      model_name: config.model_name,
    });
  }, [config, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await saveConfig(values);
      messageApi.success('配置保存成功，后端正在重启...');
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        return;
      }
      messageApi.error('保存配置失败');
    }
  };

  // 提供商变化时自动填充预设地址
  const handleProviderChange = (value: string) => {
    const defaults = providerDefaults[value];
    if (defaults) {
      form.setFieldValue('base_url', defaults.baseUrl);
    }
  };

  // 拉取模型列表
  const handleFetchModels = async () => {
    const provider = form.getFieldValue('provider');
    const baseUrl = form.getFieldValue('base_url');
    const apiKey = form.getFieldValue('api_key');

    if (!provider || !baseUrl) {
      messageApi.warning('请先选择提供商并填写 API 地址');
      return;
    }

    setLoadingModels(true);
    try {
      const list = await commands.fetchModels(provider, baseUrl, apiKey || undefined);
      if (list.length === 0) {
        messageApi.warning('未获取到任何模型');
        return;
      }
      setModelList(list);
      setModelListVisible(true);
    } catch (err) {
      messageApi.error(`获取模型列表失败: ${err}`);
    } finally {
      setLoadingModels(false);
    }
  };

  const provider = Form.useWatch('provider', form);

  return (
    <Card title="模型配置" style={{ width: '100%', maxWidth: 600 }}>
      {contextHolder}
      <Form form={form} layout="vertical" initialValues={config}>
        <Form.Item
          name="provider"
          label="模型提供商"
          rules={[{ required: true, message: '请选择模型提供商' }]}
        >
          <Select
            options={providerOptions}
            placeholder="选择模型提供商"
            onChange={handleProviderChange}
          />
        </Form.Item>

        <Form.Item
          name="base_url"
          label="API 地址"
          rules={[{ required: true, message: '请输入 API 地址' }]}
          extra={provider ? providerDefaults[provider]?.hint : undefined}
        >
          <Input placeholder="例如: http://localhost:11434/v1" />
        </Form.Item>

        <Form.Item
          name="api_key"
          label="API 密钥"
          extra="本地模型 (如 Ollama) 可留空"
        >
          <Input.Password placeholder="输入 API 密钥" visibilityToggle />
        </Form.Item>

        <Form.Item
          name="model_name"
          label="模型名称"
          rules={[{ required: true, message: '请输入模型名称' }]}
        >
          <Input
            placeholder="例如: llama3.2:1b 或 gpt-4o"
            suffix={
              FETCHABLE_PROVIDERS.includes(provider) ? (
                <Button
                  type="link"
                  size="small"
                  icon={<DownloadOutlined />}
                  loading={loadingModels}
                  onClick={handleFetchModels}
                  style={{ padding: 0 }}
                >
                  拉取模型列表
                </Button>
              ) : null
            }
          />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
            >
              保存配置
            </Button>
            <Button onClick={() => form.resetFields()} disabled={saving}>
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>

      {/* 模型列表选择弹窗 */}
      <Modal
        title="选择模型"
        open={modelListVisible}
        onCancel={() => setModelListVisible(false)}
        footer={null}
        width={480}
      >
        {modelList.length > 0 && (
          <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
            共 {modelList.length} 个模型，点击即可选择
          </Text>
        )}
        <List
          dataSource={modelList}
          style={{ maxHeight: 400, overflow: 'auto' }}
          renderItem={(item) => (
            <List.Item
              style={{
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: 6,
                transition: 'background 0.2s',
              }}
              onClick={() => {
                form.setFieldValue('model_name', item);
                setModelListVisible(false);
                messageApi.success(`已选择模型: ${item}`);
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--ant-color-fill-secondary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = '';
              }}
            >
              <Text code>{item}</Text>
            </List.Item>
          )}
        />
      </Modal>
    </Card>
  );
};

export default SettingsForm;
