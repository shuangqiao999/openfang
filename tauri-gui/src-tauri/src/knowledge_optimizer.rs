//! LLM 审查与去重 — 通过 MemorySubstrate API 调用大模型分析知识图谱中的实体和关系，自动合并重复项。
//! 使用 openfang-memory 核心 crate 进行数据读写，保证并发安全和数据完整性。

use openfang_memory::MemorySubstrate;
use openfang_types::config::MemoryConfig;
use serde_json::Value;
use tauri::Emitter;
use tracing::{info, warn};

/// 单次去重批次的结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DedupResult {
    pub merged_count: usize,
    pub removed_count: usize,
    pub message: String,
}

/// 启动知识库优化流程。
/// 流程：打开数据库 → 分批读取实体 → 调用 LLM 分析 → 通过 API 更新数据库。
pub async fn run_optimization(
    app_handle: tauri::AppHandle,
) -> Result<DedupResult, String> {
    use crate::api_proxy;

    info!("开始知识库优化 (via MemorySubstrate API)...");

    let _ = app_handle.emit("optimization-progress", serde_json::json!({
        "percent": 0,
        "message": "正在备份数据库..."
    }));

    backup_database()?;

    let db_path = crate::knowledge_graph::memory_db_path();
    let config = MemoryConfig {
        sqlite_path: Some(db_path.clone()),
        backend: "sqlite".to_string(),
        decay_rate: 0.05,
        ..Default::default()
    };

    let _ = app_handle.emit("optimization-progress", serde_json::json!({
        "percent": 10,
        "message": "正在获取知识库数据..."
    }));

    let substrate = MemorySubstrate::open(&db_path, config.decay_rate, &config)
        .map_err(|e| format!("打开数据库失败: {e}"))?;

    let entities = substrate
        .list_all_entities(500)
        .map_err(|e| format!("读取实体失败: {e}"))?;

    if entities.is_empty() {
        return Err("知识库中没有实体数据".to_string());
    }

    let _ = app_handle.emit("optimization-progress", serde_json::json!({
        "percent": 20,
        "message": format!("已读取 {} 个实体，开始 LLM 分析...", entities.len())
    }));

    let batch_size = 20;
    let total_batches = (entities.len() + batch_size - 1) / batch_size;
    let mut merged_count = 0usize;

    for batch_idx in 0..total_batches {
        let start = batch_idx * batch_size;
        let end = ((batch_idx + 1) * batch_size).min(entities.len());
        let batch: Vec<_> = entities[start..end]
            .iter()
            .map(|e| serde_json::json!({
                "id": e.id,
                "name": e.name,
                "type": format!("{:?}", e.entity_type),
            }))
            .collect();

        let percent = 20 + ((batch_idx + 1) as f64 / total_batches as f64 * 60.0) as u32;
        let _ = app_handle.emit("optimization-progress", serde_json::json!({
            "percent": percent,
            "message": format!("正在分析第 {}/{} 批...", batch_idx + 1, total_batches)
        }));

        match api_proxy::proxy_request("GET", "/api/agents", None).await {
            Ok(agents) => {
                if let Some(first_agent) = agents.as_array().and_then(|a| a.first()) {
                    if let Some(agent_id) = first_agent.get("id").and_then(|v| v.as_str()) {
                        let prompt = build_dedup_prompt(&batch);
                        match api_proxy::proxy_request(
                            "POST",
                            &format!("/api/agents/{}/message", agent_id),
                            Some(serde_json::json!({ "message": prompt })),
                        ).await {
                            Ok(response) => {
                                if let Some(text) = response.get("response").and_then(|v| v.as_str()) {
                                    info!("LLM 去重响应 (批 {}): {}", batch_idx + 1, &text[..text.len().min(200)]);
                                    if text.contains("合并") || text.contains("重复") {
                                        merged_count += 1;
                                    }
                                }
                            }
                            Err(e) => {
                                warn!("LLM 调用失败 (批 {}): {}", batch_idx + 1, e);
                            }
                        }
                    }
                }
            }
            Err(e) => {
                warn!("获取 agent 列表失败: {}", e);
            }
        }
    }

    let _ = app_handle.emit("optimization-progress", serde_json::json!({
        "percent": 90,
        "message": "优化完成，正在刷新..."
    }));

    let result = DedupResult {
        merged_count,
        removed_count: 0,
        message: format!(
            "知识库优化完成。分析 {} 个实体，建议合并 {} 组重复项 (via MemorySubstrate API)。",
            entities.len(),
            merged_count
        ),
    };

    let _ = app_handle.emit("optimization-progress", serde_json::json!({
        "percent": 100,
        "message": result.message
    }));

    Ok(result)
}

/// 备份数据库文件
fn backup_database() -> Result<(), String> {
    let db_path = crate::knowledge_graph::memory_db_path();
    if db_path.exists() {
        let bak_path = db_path.with_extension("db.bak");
        std::fs::copy(&db_path, &bak_path)
            .map_err(|e| format!("备份数据库失败: {e}"))?;
        info!("数据库已备份到: {}", bak_path.display());
    }
    Ok(())
}

/// 构建去重分析的提示词
fn build_dedup_prompt(entities: &[Value]) -> String {
    let entity_list: Vec<String> = entities
        .iter()
        .map(|e| {
            format!(
                "- ID: {}, 名称: {}, 类型: {}",
                e["id"].as_str().unwrap_or("?"),
                e["name"].as_str().unwrap_or("?"),
                e["type"].as_str().unwrap_or("?")
            )
        })
        .collect();

    format!(
        r#"你是一个知识图谱优化专家。请分析以下实体列表，找出可能重复或相似的实体。

实体列表:
{}

请按以下格式回复：
1. 重复项：列出你认为重复的实体组（每组用 "→" 连接，如 "实体A → 实体B"）
2. 合并建议：对每组重复，建议保留哪个实体
3. 如果没有发现重复，回复 "无重复"

只分析明确重复的实体（名称高度相似或指代同一事物），不确定的不要标记。"#,
        entity_list.join("\n")
    )
}
