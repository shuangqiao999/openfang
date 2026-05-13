//! 3D 知识图谱场景 — 使用 React Three Fiber 渲染节点和边。
//! 实现力导向布局、悬浮提示、点击弹窗、OrbitControls 旋转缩放。

import React, { useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { GraphData, Node3D } from '../types';

const NODE_COLORS: Record<string, string> = {
  person: '#ff4d4f',
  organization: '#1677ff',
  concept: '#52c41a',
  location: '#faad14',
  event: '#722ed1',
  default: '#8c8c8c',
};

function getNodeColor(type: string): string {
  const key = type.toLowerCase();
  return NODE_COLORS[key] || NODE_COLORS.default;
}

interface SceneProps {
  data: GraphData;
  onNodeClick: (node: GraphNodeR3F) => void;
}

export interface GraphNodeR3F {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
  x: number;
  y: number;
  z: number;
}

// 力导向布局 Hook
function useForceLayout(data: GraphData): Node3D[] {
  return useMemo(() => {
    const nodes: Node3D[] = data.nodes.map((n, i) => {
      const angle = (i / Math.max(data.nodes.length, 1)) * Math.PI * 2;
      const radius = 5 + Math.random() * 3;
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        x: Math.cos(angle) * radius,
        y: (Math.random() - 0.5) * 4,
        z: Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        vz: 0,
        properties: n.properties,
      };
    });

    const edgeMap: Map<string, string[]> = new Map();
    for (const e of data.edges) {
      const list = edgeMap.get(e.source) || [];
      list.push(e.target);
      edgeMap.set(e.source, list);
      const list2 = edgeMap.get(e.target) || [];
      list2.push(e.source);
      edgeMap.set(e.target, list2);
    }

    // 简化的力导向算法（迭代 100 次）
    for (let iter = 0; iter < 100; iter++) {
      const alpha = 0.5 * (1 - iter / 100);

      // 斥力
      for (const n of nodes) {
        let fx = 0, fy = 0, fz = 0;
        for (const m of nodes) {
          if (n.id === m.id) continue;
          let dx = n.x - m.x;
          let dy = n.y - m.y;
          let dz = n.z - m.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
          const force = 10 / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
          fz += (dz / dist) * force;
        }
        n.vx = (n.vx + fx * alpha) * 0.6;
        n.vy = (n.vy + fy * alpha) * 0.6;
        n.vz = (n.vz + fz * alpha) * 0.6;
      }

      // 引力（边）
      for (const e of data.edges) {
        const s = nodes.find((n) => n.id === e.source);
        const t = nodes.find((n) => n.id === e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dz = t.z - s.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
        const force = Math.log(dist + 1) * 0.1;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        s.vx += fx * alpha;
        s.vy += fy * alpha;
        s.vz += fz * alpha;
        t.vx -= fx * alpha;
        t.vy -= fy * alpha;
        t.vz -= fz * alpha;
      }

      // 应用速度
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        n.z += n.vz;
      }

      // 中心引力
      for (const n of nodes) {
        n.vx -= n.x * 0.001;
        n.vy -= n.y * 0.001;
        n.vz -= n.z * 0.001;
      }
    }

    return nodes;
  }, [data]);
}

// 单个节点组件
function GraphNodeComponent({
  node,
  onNodeClick,
}: {
  node: Node3D;
  onNodeClick: (n: GraphNodeR3F) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  const color = getNodeColor(node.type);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onNodeClick({
        id: node.id,
        name: node.name,
        type: node.type,
        properties: node.properties,
        x: node.x,
        y: node.y,
        z: node.z,
      });
    },
    [node, onNodeClick]
  );

  return (
    <mesh
      ref={meshRef}
      position={[node.x, node.y, node.z]}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[0.25, 16, 16]} />
      <meshStandardMaterial color={hovered ? '#fff' : color} emissive={color} emissiveIntensity={0.3} />
      {hovered && (
        <Html distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(0,0,0,0.85)',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 13,
              whiteSpace: 'nowrap',
              transform: 'translate(-50%, -120%)',
            }}
          >
            <div style={{ fontWeight: 600 }}>{node.name}</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{node.type}</div>
          </div>
        </Html>
      )}
    </mesh>
  );
}

// 边组件
function EdgeLines({ nodes, edges }: { nodes: Node3D[]; edges: GraphData['edges'] }) {
  const nodeMap = useMemo(() => {
    const m = new Map<string, Node3D>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const lines = useMemo(() => {
    const pts: number[] = [];
    const colors: number[] = [];
    for (const e of edges) {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) continue;
      pts.push(s.x, s.y, s.z, t.x, t.y, t.z);
      const c = new THREE.Color(0x888888);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    return { pts, colors };
  }, [edges, nodeMap]);

  if (lines.pts.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines.pts, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(lines.colors, 3));

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors opacity={0.4} transparent />
    </lineSegments>
  );
}

// 力导向动画 — 在每帧更新节点位置
function ForceFrame({
  nodes,
  meshRefs,
}: {
  nodes: Node3D[];
  meshRefs: React.MutableRefObject<Map<string, THREE.Mesh>>;
}) {
  useFrame(() => {
    for (const n of nodes) {
      const mesh = meshRefs.current.get(n.id);
      if (mesh) {
        mesh.position.set(n.x, n.y, n.z);
      }
    }
  });
  return null;
}

// 主场景
const Graph3DScene: React.FC<SceneProps> = ({ data, onNodeClick }) => {
  const layoutNodes = useForceLayout(data);
  const meshRefs = useRef<Map<string, THREE.Mesh>>(new Map());

  if (data.nodes.length === 0) return null;

  return (
    <Canvas
      camera={{ position: [0, 0, 15], fov: 50 }}
      style={{ background: '#0a0a1a', width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <OrbitControls enableDamping dampingFactor={0.1} />

      <EdgeLines nodes={layoutNodes} edges={data.edges} />

      {layoutNodes.map((node) => (
        <GraphNodeComponent key={node.id} node={node} onNodeClick={onNodeClick} />
      ))}

      <ForceFrame nodes={layoutNodes} meshRefs={meshRefs} />

      {/* 网格参考面 */}
      <gridHelper args={[20, 20, '#222', '#111']} />
    </Canvas>
  );
};

export default Graph3DScene;
