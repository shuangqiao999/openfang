import React from 'react';
import { Upload, Button, message, Tooltip } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

interface FileAttachmentProps {
  onFileSelect: (content: string, fileName: string) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const FileAttachment: React.FC<FileAttachmentProps> = ({ onFileSelect, disabled }) => {
  const props: UploadProps = {
    beforeUpload: (file) => {
      if (file.size > MAX_FILE_SIZE) {
        message.error(`文件过大 (${(file.size / 1024 / 1024).toFixed(1)}MB)，请选择小于 5MB 的文件`);
        return false;
      }

      const isText =
        file.type.startsWith('text/') ||
        file.type === 'application/json' ||
        file.type === 'application/javascript' ||
        file.type === 'application/xml' ||
        file.name.endsWith('.toml') ||
        file.name.endsWith('.rs') ||
        file.name.endsWith('.py') ||
        file.name.endsWith('.ts') ||
        file.name.endsWith('.tsx') ||
        file.name.endsWith('.js') ||
        file.name.endsWith('.jsx') ||
        file.name.endsWith('.yaml') ||
        file.name.endsWith('.yml') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.log');

      const reader = new FileReader();
      reader.onload = (e) => {
        const raw = e.target?.result;
        if (typeof raw === 'string') {
          if (isText) {
            // 文本文件：完整读取，不截断
            onFileSelect(raw, file.name);
            message.success(`已添加: ${file.name} (${raw.length} 字符)`);
          } else if (file.type.startsWith('image/')) {
            onFileSelect(`[图片: ${file.name}]`, file.name);
            message.success(`已添加图片: ${file.name}`);
          } else {
            onFileSelect(`[二进制文件: ${file.name}] (大小: ${(file.size / 1024).toFixed(1)}KB)`, file.name);
            message.info(`已添加: ${file.name}，仅文件名将发送`);
          }
        }
      };
      reader.readAsText(file);
      return false;
    },
    showUploadList: false,
  };

  return (
    <Upload {...props} disabled={disabled}>
      <Tooltip title="添加附件（文本/图片，最大 5MB）">
        <Button type="text" icon={<PaperClipOutlined />} disabled={disabled} />
      </Tooltip>
    </Upload>
  );
};

export default FileAttachment;
