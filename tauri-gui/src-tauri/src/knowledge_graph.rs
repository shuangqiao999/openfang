//! 知识图谱数据查询 — 从 OpenFang 的 SQLite 数据库读取实体和关系。

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 知识图谱节点（对应 entities 表）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub properties: serde_json::Value,
    pub created_at: String,
}

/// 知识图谱边（对应 relations 表）
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

/// 获取 memory.db 的路径
pub fn memory_db_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".openfang")
        .join("data")
        .join("openfang.db")
}

/// 备用路径（部分版本直接使用 openfang.db）
fn alt_db_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".openfang")
        .join("openfang.db")
}

/// 从 SQLite 数据库加载知识图谱数据。
/// 查询 entities 和 relations 表，限制最大节点和边数量。
pub fn load_graph_data(max_nodes: usize, max_edges: usize) -> Result<GraphData, String> {
    let db_path = {
        let primary = memory_db_path();
        if primary.exists() {
            primary
        } else {
            let alt = alt_db_path();
            if alt.exists() {
                alt
            } else {
                return Err(format!(
                    "未找到数据库文件。请确认 OpenFang 已完成初始化。\n尝试路径:\n  {}\n  {}",
                    primary.display(),
                    alt.display()
                ));
            }
        }
    };

    let conn = Connection::open(&db_path).map_err(|e| format!("打开数据库失败: {e}"))?;

    // 查询实体
    let mut stmt = conn
        .prepare(
            "SELECT id, name, entity_type, properties, created_at FROM entities LIMIT ?1",
        )
        .map_err(|e| format!("查询实体失败: {e}"))?;

    let nodes: Vec<GraphNode> = stmt
        .query_map([max_nodes as i64], |row| {
            let props_str: String = row.get(3)?;
            let properties: serde_json::Value =
                serde_json::from_str(&props_str).unwrap_or(serde_json::Value::Object(Default::default()));
            Ok(GraphNode {
                id: row.get(0)?,
                name: row.get(1)?,
                node_type: row.get::<_, String>(2)?,
                properties,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("读取实体数据失败: {e}"))?
        .filter_map(|r| r.ok())
        .collect();

    // 查询关系到已加载的实体
    let node_ids: Vec<String> = nodes.iter().map(|n| n.id.clone()).collect();

    if node_ids.is_empty() {
        return Ok(GraphData {
            nodes: vec![],
            edges: vec![],
        });
    }

    // 构建 IN 子句的占位符
    let placeholders: Vec<String> = node_ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    let in_clause = placeholders.join(", ");

    let sql = format!(
        "SELECT source_entity, target_entity, relation_type, confidence, properties \
         FROM relations \
         WHERE source_entity IN ({}) AND target_entity IN ({}) \
         LIMIT {}",
        in_clause, in_clause, max_edges
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("查询关系失败: {e}"))?;

    // 构建参数：每个 node_id 出现两次（source 和 target）
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    for id in &node_ids {
        params.push(Box::new(id.clone()));
    }
    for id in &node_ids {
        params.push(Box::new(id.clone()));
    }

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let edges: Vec<GraphEdge> = stmt
        .query_map(param_refs.as_slice(), |row| {
            let props_str: String = row.get(4)?;
            let properties: serde_json::Value =
                serde_json::from_str(&props_str).unwrap_or(serde_json::Value::Object(Default::default()));
            let rel_type: String = row.get(2)?;
            Ok(GraphEdge {
                source: row.get(0)?,
                target: row.get(1)?,
                label: rel_type,
                confidence: row.get(3)?,
                properties,
            })
        })
        .map_err(|e| format!("读取关系数据失败: {e}"))?
        .filter_map(|r| r.ok())
        .collect();

    tracing::info!(
        "知识图谱已加载: {} 个实体, {} 条关系",
        nodes.len(),
        edges.len()
    );

    Ok(GraphData { nodes, edges })
}
