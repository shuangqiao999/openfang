//! Tauri IPC 命令处理器。
//! 所有前端 invoke() 调用在此处理，转发到 openfang.exe 或本地配置管理。

use crate::api_proxy;
use crate::config_manager::{self, ModelConfig};
use crate::AppState;
use serde_json::Value;
use tauri::Emitter;
use tracing::info;

/// 获取 Agent 模板列表（从内置资源读取）。
#[tauri::command]
pub async fn list_agent_templates() -> Result<Vec<Value>, String> {
    let resource_dir = std::env::var("TAURI_RESOURCE_DIR")
        .unwrap_or_else(|_| String::new());

    // 尝试多个可能的模板路径
    let candidates = vec![
        std::path::PathBuf::from(&resource_dir).join("agent-templates"),
        std::path::PathBuf::from("agent-templates"),
    ];

    let mut templates = Vec::new();

    for dir in &candidates {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map_or(false, |ext| ext == "toml") {
                    let content = std::fs::read_to_string(&path).unwrap_or_default();
                    let name = path
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();

                    // 从 TOML 中提取描述
                    let description = toml::from_str::<Value>(&content)
                        .ok()
                        .and_then(|v| {
                            v.get("description")
                                .and_then(|d| d.as_str())
                                .map(String::from)
                        })
                        .unwrap_or_else(|| "无描述".to_string());

                    templates.push(serde_json::json!({
                        "name": name,
                        "description": description,
                    }));
                }
            }
        }
    }

    if templates.is_empty() {
        // 返回内置的默认模板列表
        templates = vec![
            serde_json::json!({"name": "assistant", "description": "通用助手，可处理各类任务"}),
            serde_json::json!({"name": "researcher", "description": "调研员，擅长信息收集和分析"}),
            serde_json::json!({"name": "coder", "description": "程序员，擅长代码编写和调试"}),
            serde_json::json!({"name": "writer", "description": "写手，擅长内容创作和文案撰写"}),
        ];
    }

    Ok(templates)
}

/// 启动 openfang.exe 后端。
#[tauri::command]
pub async fn start_backend(
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    state
        .process_manager
        .start()
        .await
        .map_err(|e| format!("启动失败: {e}"))?;
    let _ = app.emit("backend-status-change", "running");
    Ok("started".to_string())
}

/// 停止 openfang.exe 后端。
#[tauri::command]
pub async fn stop_backend(
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    state
        .process_manager
        .stop()
        .map_err(|e| format!("停止失败: {e}"))?;
    let _ = app.emit("backend-status-change", "stopped");
    Ok("stopped".to_string())
}

/// 重启 openfang.exe 后端。
#[tauri::command]
pub async fn restart_backend(
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    state
        .process_manager
        .restart()
        .await
        .map_err(|e| format!("重启失败: {e}"))?;
    let _ = app.emit("backend-status-change", "running");
    Ok("restarted".to_string())
}

/// 获取后端健康状态。
#[tauri::command]
pub async fn get_backend_status(
    state: tauri::State<'_, AppState>,
) -> Result<Value, String> {
    let healthy = state.process_manager.check_health().await;

    let version = if healthy {
        api_proxy::proxy_request("GET", "/api/version", None)
            .await
            .ok()
            .and_then(|v| v.get("version").and_then(|s| s.as_str()).map(String::from))
            .unwrap_or_else(|| "未知".to_string())
    } else {
        "未知".to_string()
    };

    Ok(serde_json::json!({
        "healthy": healthy,
        "version": version,
    }))
}

/// 获取模型配置。
#[tauri::command]
pub async fn get_config() -> Result<ModelConfig, String> {
    config_manager::read_config().map_err(|e| format!("读取配置失败: {e}"))
}

/// 保存模型配置并重启后端。
#[tauri::command]
pub async fn set_config(
    cfg: ModelConfig,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    config_manager::write_config(&cfg).map_err(|e| format!("保存配置失败: {e}"))?;
    info!("配置已更新，正在重启后端...");
    // 重启后端使配置生效
    restart_backend(state, app).await?;
    Ok("ok".to_string())
}

/// 获取所有 Agent 列表。
#[tauri::command]
pub async fn list_agents() -> Result<Value, String> {
    api_proxy::proxy_request("GET", "/api/agents", None).await
}

/// 创建新 Agent。
#[tauri::command]
pub async fn create_agent(name: String, template: String) -> Result<Value, String> {
    // 尝试从内置资源加载模板
    let manifest_toml = load_template_toml(&template, &name)?;

    let body = serde_json::json!({
        "manifest_toml": manifest_toml,
    });

    api_proxy::proxy_request("POST", "/api/agents", Some(body)).await
}

/// 从资源目录或内置模板加载 agent TOML，并替换 agent 名称为用户指定的名称。
fn load_template_toml(template_name: &str, agent_name: &str) -> Result<String, String> {
    let resource_dir = std::env::var("TAURI_RESOURCE_DIR").unwrap_or_default();

    let candidates = vec![
        std::path::PathBuf::from(&resource_dir)
            .join("agent-templates")
            .join(format!("{}.toml", template_name)),
        std::path::PathBuf::from("agent-templates").join(format!("{}.toml", template_name)),
    ];

    for path in &candidates {
        if path.exists() {
            let content = std::fs::read_to_string(path)
                .map_err(|e| format!("读取模板文件失败: {e}"))?;
            return Ok(replace_agent_name(&content, agent_name));
        }
    }

    // 如果找不到模板文件，生成默认的 assistant 模板
    let default_template = format!(
        r#"name = "{name}"
version = "0.1.0"
description = "用户创建的 Agent: {name}"
author = "openfang-tauri-gui"
module = "builtin:chat"
tags = ["general", "assistant"]

[model]
provider = "default"
model = "default"
max_tokens = 8192
temperature = 0.5
system_prompt = "你是一个有用的 AI 助手。"

[capabilities]
tools = ["file_read", "file_write", "file_list", "memory_store", "memory_recall", "web_fetch", "shell_exec"]
network = ["*"]
memory_read = ["*"]
memory_write = ["self.*", "shared.*"]
"#,
        name = agent_name,
    );

    Ok(default_template)
}

/// 替换 TOML 文件中第一个 name = "..." 字段为新的 agent 名称。
fn replace_agent_name(toml_content: &str, new_name: &str) -> String {
    let mut lines: Vec<String> = toml_content.lines().map(|s| s.to_string()).collect();
    for line in &mut lines {
        let trimmed = line.trim();
        if trimmed.starts_with("name") && trimmed.contains('=') {
            let indent_len = line.len() - line.trim_start().len();
            let indent = &line[..indent_len];
            *line = format!("{}name = \"{}\"", indent, new_name);
            break;
        }
    }
    lines.join("\n")
}

/// 删除 Agent。
#[tauri::command]
pub async fn delete_agent(agent_id: String) -> Result<Value, String> {
    api_proxy::proxy_request("DELETE", &format!("/api/agents/{}", agent_id), None).await
}

/// 发送流式消息。
#[tauri::command]
pub async fn send_message_stream(
    agent_id: String,
    message: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    api_proxy::send_message_stream(&agent_id, &message, app).await
}
