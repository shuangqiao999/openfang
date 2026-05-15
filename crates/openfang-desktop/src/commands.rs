//! Tauri IPC command handlers.

use crate::{KernelState, PortState};
use openfang_kernel::config::openfang_home;
use openfang_runtime::drivers;
use openfang_runtime::llm_driver::{CompletionRequest, DriverConfig};
use openfang_types::memory::{EntityType, Memory, RelationType};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_dialog::DialogExt;
use tracing::info;

/// Get the port the embedded server is listening on.
#[tauri::command]
pub fn get_port(port: tauri::State<'_, PortState>) -> u16 {
    port.0
}

/// Get a status summary of the running kernel.
#[tauri::command]
pub fn get_status(
    port: tauri::State<'_, PortState>,
    kernel_state: tauri::State<'_, KernelState>,
) -> serde_json::Value {
    let agents = kernel_state.kernel.registry.list().len();
    let uptime_secs = kernel_state.started_at.elapsed().as_secs();

    serde_json::json!({
        "status": "running",
        "port": port.0,
        "agents": agents,
        "uptime_secs": uptime_secs,
    })
}

/// Get the number of registered agents.
#[tauri::command]
pub fn get_agent_count(kernel_state: tauri::State<'_, KernelState>) -> usize {
    kernel_state.kernel.registry.list().len()
}

/// Open a native file picker to import an agent TOML manifest.
///
/// Validates the TOML as a valid `AgentManifest`, copies it to
/// `~/.openfang/agents/{name}/agent.toml`, then spawns the agent.
#[tauri::command]
pub fn import_agent_toml(
    app: tauri::AppHandle,
    kernel_state: tauri::State<'_, KernelState>,
) -> Result<String, String> {
    let path = app
        .dialog()
        .file()
        .set_title("Import Agent Manifest")
        .add_filter("TOML files", &["toml"])
        .blocking_pick_file();

    let file_path = match path {
        Some(p) => p,
        None => return Err("No file selected".to_string()),
    };

    let content = std::fs::read_to_string(file_path.as_path().ok_or("Invalid file path")?)
        .map_err(|e| format!("Failed to read file: {e}"))?;

    let manifest: openfang_types::agent::AgentManifest =
        toml::from_str(&content).map_err(|e| format!("Invalid agent manifest: {e}"))?;

    let agent_name = manifest.name.clone();
    let agent_dir = openfang_home().join("agents").join(&agent_name);
    std::fs::create_dir_all(&agent_dir)
        .map_err(|e| format!("Failed to create agent directory: {e}"))?;

    let dest = agent_dir.join("agent.toml");
    std::fs::write(&dest, &content).map_err(|e| format!("Failed to write manifest: {e}"))?;

    kernel_state
        .kernel
        .spawn_agent(manifest)
        .map_err(|e| format!("Failed to spawn agent: {e}"))?;

    info!("Imported and spawned agent \"{agent_name}\"");
    Ok(agent_name)
}

/// Open a native file picker to import a skill file.
///
/// Copies the selected file to `~/.openfang/skills/` and triggers a
/// hot-reload of the skill registry.
#[tauri::command]
pub fn import_skill_file(
    app: tauri::AppHandle,
    kernel_state: tauri::State<'_, KernelState>,
) -> Result<String, String> {
    let path = app
        .dialog()
        .file()
        .set_title("Import Skill File")
        .add_filter("Skill files", &["md", "toml", "py", "js", "wasm"])
        .blocking_pick_file();

    let file_path = match path {
        Some(p) => p,
        None => return Err("No file selected".to_string()),
    };

    let src = file_path.as_path().ok_or("Invalid file path")?;
    let file_name = src
        .file_name()
        .ok_or("No filename")?
        .to_string_lossy()
        .to_string();

    let skills_dir = openfang_home().join("skills");
    std::fs::create_dir_all(&skills_dir)
        .map_err(|e| format!("Failed to create skills directory: {e}"))?;

    let dest = skills_dir.join(&file_name);
    std::fs::copy(src, &dest).map_err(|e| format!("Failed to copy skill file: {e}"))?;

    kernel_state.kernel.reload_skills();

    info!("Imported skill file \"{file_name}\" and reloaded registry");
    Ok(file_name)
}

/// Check whether auto-start on login is enabled.
#[tauri::command]
pub fn get_autostart(app: tauri::AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

/// Enable or disable auto-start on login.
#[tauri::command]
pub fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<bool, String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|e| e.to_string())?;
    } else {
        manager.disable().map_err(|e| e.to_string())?;
    }
    manager.is_enabled().map_err(|e| e.to_string())
}

/// Perform an on-demand update check.
#[tauri::command]
pub async fn check_for_updates(
    app: tauri::AppHandle,
) -> Result<crate::updater::UpdateInfo, String> {
    crate::updater::check_for_update(&app).await
}

/// Download and install the latest update, then restart the app.
/// Returns Ok(()) which triggers an app restart — the command will not return
/// if the update succeeds (the app restarts). On error, returns Err(message).
#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    crate::updater::download_and_install_update(&app).await
}

/// Open the OpenFang config directory (`~/.openfang/`) in the OS file manager.
#[tauri::command]
pub fn open_config_dir() -> Result<(), String> {
    let dir = openfang_home();
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
    open::that(&dir).map_err(|e| format!("Failed to open directory: {e}"))
}

/// Open the OpenFang logs directory (`~/.openfang/logs/`) in the OS file manager.
#[tauri::command]
pub fn open_logs_dir() -> Result<(), String> {
    let dir = openfang_home().join("logs");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create logs dir: {e}"))?;
    open::that(&dir).map_err(|e| format!("Failed to open directory: {e}"))
}

// ── Knowledge Graph Commands ──────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphNode {
    pub id: String,
    pub name: String,
    pub group: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphLink {
    pub source: String,
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relationship: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KnowledgeGraphData {
    pub nodes: Vec<GraphNode>,
    pub links: Vec<GraphLink>,
}

#[tauri::command]
pub fn get_knowledge_graph(
    kernel_state: tauri::State<'_, KernelState>,
    limit: Option<usize>,
) -> Result<KnowledgeGraphData, String> {
    let limit = limit.unwrap_or(500);

    let entities = kernel_state.kernel.memory.list_entities(limit)
        .map_err(|e| format!("Failed to load entities: {e}"))?;

    let relations = kernel_state.kernel.memory.list_relations(limit)
        .map_err(|e| format!("Failed to load relations: {e}"))?;

    let nodes: Vec<GraphNode> = entities
        .into_iter()
        .filter(|e| !e.properties.get("duplicate").and_then(|v| v.as_bool()).unwrap_or(false))
        .map(|e| {
            GraphNode {
                id: e.id,
                name: e.name,
                group: entity_type_group(&e.entity_type),
                r#type: Some(entity_type_label(&e.entity_type)),
                description: e.properties.get("description").and_then(|v| v.as_str()).map(|s| s.to_string()),
            }
        })
        .collect();

    let links: Vec<GraphLink> = relations
        .into_iter()
        .map(|r| GraphLink {
            source: r.source,
            target: r.target,
            relationship: Some(relation_type_label(&r.relation)),
        })
        .collect();

    Ok(KnowledgeGraphData { nodes, links })
}

// ── LLM Review ────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReviewProgressPayload {
    pub percent: u32,
    pub status: String,
    pub processed: usize,
    pub removed: usize,
    pub results: Vec<ReviewItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReviewCompletePayload {
    pub message: String,
    pub processed: usize,
    pub removed: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReviewItem {
    pub id: String,
    pub name: String,
    pub action: String,
    pub reason: String,
}

#[tauri::command]
pub async fn llm_review_knowledge(
    app: AppHandle,
    kernel_state: tauri::State<'_, KernelState>,
    batch_size: Option<usize>,
    similarity_threshold: Option<f32>,
) -> Result<(), String> {
    let batch_size = batch_size.unwrap_or(50);
    let _similarity = similarity_threshold.unwrap_or(0.85);
    let kernel = kernel_state.kernel.clone();

    let model_name = get_current_model(&kernel).map_err(|e| {
        let _ = app.emit("llm-review-error", serde_json::json!({"error": &e}));
        e
    })?;
    let driver = build_llm_driver(&kernel).map_err(|e| {
        let _ = app.emit("llm-review-error", serde_json::json!({"error": &e}));
        e
    })?;

    tokio::spawn(async move {
        let entities = match kernel.memory.list_entities(1000) {
            Ok(e) => e,
            Err(e) => {
                let _ = app.emit("llm-review-error", serde_json::json!({"error": format!("Failed to load entities: {e}")}));
                return;
            }
        };

        if entities.is_empty() {
            let _ = app.emit("llm-review-complete", ReviewCompletePayload {
                message: "No entities in knowledge graph".into(),
                processed: 0,
                removed: 0,
            });
            return;
        }

        let total = entities.len();
        let _ = app.emit("llm-review-progress", ReviewProgressPayload {
            percent: 0,
            status: format!("Starting review of {total} entities..."),
            processed: 0,
            removed: 0,
            results: vec![],
        });

        let mut processed = 0usize;
        let mut removed = 0usize;
        let mut results: Vec<ReviewItem> = Vec::new();

        for chunk in entities.chunks(batch_size) {
            for entity in chunk {
                let recent = results.iter().filter(|r| r.action == "kept").rev().take(10)
                    .map(|r| r.name.as_str()).collect::<Vec<_>>().join(", ");
                let prompt = if recent.is_empty() {
                    format!("Review this knowledge entry. Return JSON only: {{\"keep\": true/false, \"refined\": \"concise version under 80 chars\", \"reason\": \"under 50 chars\"}}\n\nEntry: \"{}\"", entity.name)
                } else {
                    format!("Check if this is a duplicate of: [{}]. Return JSON only: {{\"keep\": true/false, \"refined\": \"concise version\", \"reason\": \"under 50 chars\"}}\n\nEntry: \"{}\"", recent, entity.name)
                };

                let request = CompletionRequest {
                    model: model_name.clone(),
                    messages: vec![openfang_types::message::Message::user(&prompt)],
                    tools: vec![],
                    max_tokens: 256,
                    temperature: 0.3,
                    system: Some("You are a knowledge quality reviewer. Always respond with valid JSON only.".into()),
                    thinking: None,
                };

                match driver.complete(request).await {
                    Ok(resp) => {
                        let text = resp.text().trim().to_string();
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                            let keep = val.get("keep").and_then(|v| v.as_bool()).unwrap_or(true);
                            let refined = val.get("refined").and_then(|v| v.as_str()).unwrap_or(&entity.name).to_string();
                            let reason = val.get("reason").and_then(|v| v.as_str()).unwrap_or("reviewed").to_string();
                            if !keep {
                                let mut updated = entity.clone();
                                updated.updated_at = chrono::Utc::now();
                                updated.properties.insert("duplicate".to_string(), serde_json::json!(true));
                                if let Err(e) = kernel.memory.add_entity(updated).await {
                                    tracing::warn!("Failed to mark entity {} as duplicate: {}", entity.id, e);
                                }
                                removed += 1;
                            } else if refined != entity.name {
                                let mut updated = entity.clone();
                                updated.updated_at = chrono::Utc::now();
                                updated.name = refined.clone();
                                if let Err(e) = kernel.memory.add_entity(updated).await {
                                    tracing::warn!("Failed to update entity {}: {}", entity.id, e);
                                }
                            }
                            results.push(ReviewItem { id: entity.id.clone(), name: refined, action: if keep { "kept".into() } else { "removed".into() }, reason });
                        } else {
                            results.push(ReviewItem { id: entity.id.clone(), name: entity.name.clone(), action: "kept".into(), reason: "LLM response unparseable".into() });
                        }
                    }
                    Err(e) => {
                        results.push(ReviewItem { id: entity.id.clone(), name: entity.name.clone(), action: "kept".into(), reason: format!("LLM error: {e}") });
                    }
                }

                processed += 1;
                if processed.is_multiple_of(10) || processed == total {
                    let percent = ((processed as f32 / total as f32) * 100.0) as u32;
                    let _ = app.emit("llm-review-progress", ReviewProgressPayload {
                        percent, status: format!("Reviewed {processed}/{total}"), processed, removed,
                        results: results.iter().rev().take(10).cloned().collect(),
                    });
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        }

        let _ = app.emit("llm-review-complete", ReviewCompletePayload {
            message: format!("Review complete: {processed} processed, {removed} duplicates removed"),
            processed, removed,
        });
    });

    Ok(())
}

fn build_llm_driver(kernel: &openfang_kernel::OpenFangKernel) -> Result<std::sync::Arc<dyn openfang_runtime::llm_driver::LlmDriver>, String> {
    let m = &kernel.config.default_model;
    let config = DriverConfig {
        provider: m.provider.clone(),
        api_key: if m.api_key_env.is_empty() { None } else { std::env::var(&m.api_key_env).ok() },
        base_url: m.base_url.clone(),
        skip_permissions: true,
        subprocess_timeout_secs: None,
    };
    drivers::create_driver(&config).map_err(|e| format!("Failed to create LLM driver: {e}"))
}

fn get_current_model(kernel: &openfang_kernel::OpenFangKernel) -> Result<String, String> {
    if let Ok(g) = kernel.default_model_override.read() {
        if let Some(c) = g.as_ref() { if !c.model.is_empty() { return Ok(c.model.clone()); } }
    }
    if !kernel.config.default_model.model.is_empty() { return Ok(kernel.config.default_model.model.clone()); }
    Err("No default model configured. Set [default_model] in config.toml.".into())
}

fn entity_type_label(et: &EntityType) -> String {
    match et { EntityType::Person => "Person".into(), EntityType::Organization => "Organization".into(), EntityType::Project => "Project".into(), EntityType::Concept => "Concept".into(), EntityType::Event => "Event".into(), EntityType::Location => "Location".into(), EntityType::Document => "Document".into(), EntityType::Tool => "Tool".into(), EntityType::Custom(s) => s.clone() }
}

fn entity_type_group(et: &EntityType) -> String {
    match et { EntityType::Person => "agent".into(), EntityType::Organization | EntityType::Project => "feature".into(), EntityType::Concept => "system".into(), EntityType::Event => "feature".into(), EntityType::Location => "infra".into(), EntityType::Document => "feature".into(), EntityType::Tool => "infra".into(), EntityType::Custom(_) => "unknown".into() }
}

fn relation_type_label(rt: &RelationType) -> String {
    match rt { RelationType::WorksAt => "works_at".into(), RelationType::KnowsAbout => "knows_about".into(), RelationType::RelatedTo => "related_to".into(), RelationType::DependsOn => "depends_on".into(), RelationType::OwnedBy => "owned_by".into(), RelationType::CreatedBy => "created_by".into(), RelationType::LocatedIn => "located_in".into(), RelationType::PartOf => "part_of".into(), RelationType::Uses => "uses".into(), RelationType::Produces => "produces".into(), RelationType::Custom(s) => s.clone() }
}
