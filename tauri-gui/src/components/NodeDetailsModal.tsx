import React from 'react';
import { Modal, Descriptions, Tag, Typography } from 'antd';
import type { GraphData } from '../types';

const { Text, Paragraph } = Typography;

interface NodeDetailsModalProps {
  open: boolean;
  node: {
    id: string;
    name: string;
    type: string;
    properties: Record<string, unknown>;
  } | null;
  graphData: GraphData | null;
  onClose: () => void;
}

const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({ open, node, graphData, onClose }) => {
  if (!node) return null;

  // 筛选与该节点相关的关系
  const relatedEdges = graphData?.edges.filter(
    (e) => e.source === node.id || e.target === node.id
  ) || [];

  // 找到关系对应的另一端的实体
  const relatedNodes = new Map<string, string>();
  for (const e of relatedEdges) {
    const otherId = e.source === node.id ? e.target : e.source;
    const otherNode = graphData?.nodes.find((n) => n.id === otherId);
    if (otherNode) {
      relatedNodes.set(otherId, otherNode.name);
    }
  }

  return (
    <Modal
      title={
        <span>
          <Tag color="blue">{node.type}</Tag>
          {node.name}
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
    >
      <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="ID">
          <Text code>{node.id}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="类型">{node.type}</Descriptions.Item>
        <Descriptions.Item label="属性">
          <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto', margin: 0 }}>
            {JSON.stringify(node.properties, null, 2)}
          </pre>
        </Descriptions.Item>
      </Descriptions>

      {relatedEdges.length > 0 && (
        <>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            关联关系 ({relatedEdges.length})
          </Text>
          {relatedEdges.map((e) => {
            const otherId = e.source === node.id ? e.target : e.source;
            const otherName = relatedNodes.get(otherId) || otherId;
            const direction = e.source === node.id ? '→' : '←';
            return (
              <Paragraph
                key={`${e.source}-${e.label}-${e.target}`}
                style={{
                  padding: '6px 10px',
                  background: 'var(--ant-color-fill-secondary)',
                  borderRadius: 6,
                  marginBottom: 6,
                  fontSize: 13,
                }}
              >
                {e.source === node.id ? node.name : otherName}
                {' '}
                <Tag color="purple" style={{ fontSize: 11 }}>{direction} {e.label}</Tag>
                {' '}
                {e.source === node.id ? otherName : node.name}
                {e.confidence < 1 && (
                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                    置信度: {(e.confidence * 100).toFixed(0)}%
                  </Text>
                )}
              </Paragraph>
            );
          })}
        </>
      )}

      {relatedEdges.length === 0 && (
        <Text type="secondary">暂无关联关系</Text>
      )}
    </Modal>
  );
};

export default NodeDetailsModal;
