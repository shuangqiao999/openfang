import React from 'react';
import { Upload, Button, message, Tooltip } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

interface FileAttachmentProps {
  onFileSelect: (content: string, fileName: string) => void;
  disabled?: boolean;
}

const FileAttachment: React.FC<FileAttachmentProps> = ({ onFileSelect, disabled }) => {
  const props: UploadProps = {
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const raw = e.target?.result;
        if (typeof raw === 'string') {
          if (file.type.startsWith('text/') || file.type === 'application/json') {
            onFileSelect(raw, file.name);
          } else if (file.type.startsWith('image/')) {
            // 图片以文件名引用
            onFileSelect(`[图片: ${file.name}] (请使用多模态模型查看)`, file.name);
          } else {
            onFileSelect(`[文件: ${file.name}]\n内容：\n${raw.slice(0, 2000)}`, file.name);
          }
        }
        message.success(`已添加附件: ${file.name}`);
      };
      reader.readAsText(file);
      return false; // 阻止自动上传
    },
    showUploadList: false,
  };

  return (
    <Upload {...props} disabled={disabled}>
      <Tooltip title="添加附件（文本/图片/PDF）">
        <Button
          type="text"
          icon={<PaperClipOutlined />}
          disabled={disabled}
        />
      </Tooltip>
    </Upload>
  );
};

export default FileAttachment;
