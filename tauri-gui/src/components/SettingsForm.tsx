import React, { useEffect } from 'react';
import { Form, Input, Select, Button, Card, Space, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useConfigStore } from '../stores/configStore';

const providerOptions = [
  { label: 'Ollama (本地)', value: 'ollama' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'OpenAI 兼容 (本地)', value: 'openai_compatible' },
  { label: 'Anthropic', value: 'anthropic' },
];

const providerHints: Record<string, string> = {
  ollama: 'Ollama 默认地址: http://localhost:11434/v1',
  openai: 'OpenAI 默认地址: https://api.openai.com/v1',
  openai_compatible: '例如: http://localhost:1234/v1 (LM Studio 等)',
  anthropic: 'Anthropic 默认地址: https://api.anthropic.com',
};

const SettingsForm: React.FC = () => {
  const { config, saving, fetchConfig, saveConfig } = useConfigStore();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

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
        // 表单验证错误，不需要额外处理
        return;
      }
      messageApi.error('保存配置失败');
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
          <Select options={providerOptions} placeholder="选择模型提供商" />
        </Form.Item>

        <Form.Item
          name="base_url"
          label="API 地址"
          rules={[{ required: true, message: '请输入 API 地址' }]}
          extra={provider ? providerHints[provider] : undefined}
        >
          <Input placeholder="例如: http://localhost:11434/v1" />
        </Form.Item>

        <Form.Item
          name="api_key"
          label="API 密钥"
          extra="本地模型 (如 Ollama) 可留空"
        >
          <Input.Password
            placeholder="输入 API 密钥"
            visibilityToggle
          />
        </Form.Item>

        <Form.Item
          name="model_name"
          label="模型名称"
          rules={[{ required: true, message: '请输入模型名称' }]}
        >
          <Input placeholder="例如: llama3.2:1b 或 gpt-4o" />
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
    </Card>
  );
};

export default SettingsForm;
