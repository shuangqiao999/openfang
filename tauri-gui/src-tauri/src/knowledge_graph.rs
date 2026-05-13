//! 知识图谱数据查询 — 通过 OpenFang MemorySubstrate API 读取实体和关系。
//! 复用 openfang-memory 核心 crate，不直接访问 SQLite。

use openfang_memory::MemorySubstrate;
use openfang_types::config::MemoryConfig;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 知识图谱节点（对应 Entity 类型）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub properties: serde_json::Value,
    pub created_at: String,
}

/// 知识图谱边（对应 Relation 类型）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    pub label: String,
    pub confidence: f64,
    pub properties: serde_json::Value,
}

/// 完整图谱数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

/// 获取 memory.db 路径
pub fn memory_db_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".openfang")
        .join("data")
        .join("openfang.db")
}

/// 通过 MemorySubstrate API 加载知识图谱数据。
pub fn load_graph_data(max_nodes: usize, max_edges: usize) -> Result<GraphData, String> {
    let db_path = memory_db_path();
    let alt_path = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".openfang")
        .join("openfang.db");

    let path = if db_path.exists() {
        db_path
    } else if alt_path.exists() {
        alt_path
    } else {
        return Err(format!(
            "未找到数据库文件。请确认 OpenFang 已完成初始化。\n尝试路径:\n  {}\n  {}",
            db_path.display(),
            alt_path.display()
        ));
    };

    let config = MemoryConfig {
        sqlite_path: Some(path.clone()),
        backend: "sqlite".to_string(),
        decay_rate: 0.05,
        ..Default::default()
    };

    let substrate = MemorySubstrate::open(&path, config.decay_rate, &config)
        .map_err(|e| format!("打开数据库失败: {e}"))?;

    // 获取实体
    let entities = substrate
        .list_all_entities(max_nodes)
        .map_err(|e| format!("读取实体数据失败: {e}"))?;

    let nodes: Vec<GraphNode> = entities
        .into_iter()
        .map(|e| {
            let entity_type = format!("{:?}", e.entity_type);
            GraphNode {
                id: e.id,
                name: e.name,
                node_type: entity_type,
                properties: serde_json::to_value(e.properties).unwrap_or_default(),
                created_at: e.created_at.to_rfc3339(),
            }
        })
        .collect();

    // 获取关系
    let node_ids: Vec<String> = nodes.iter().map(|n| n.id.clone()).collect();
    let relations = substrate
        .list_all_relations(&node_ids, max_edges)
        .map_err(|e| format!("读取关系数据失败: {e}"))?;

    let edges: Vec<GraphEdge> = relations
        .into_iter()
        .map(|r| {
            let relation_type = format!("{:?}", r.relation);
            GraphEdge {
                source: r.source,
                target: r.target,
                label: relation_type,
                confidence: r.confidence as f64,
                properties: serde_json::to_value(r.properties).unwrap_or_default(),
            }
        })
        .collect();

    tracing::info!(
        "知识图谱已加载: {} 个实体, {} 条关系 (via MemorySubstrate API)",
        nodes.len(),
        edges.len()
    );

    Ok(GraphData { nodes, edges })
}
