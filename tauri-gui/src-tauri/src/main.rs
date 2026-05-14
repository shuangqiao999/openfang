mod child_process;
mod commands;
mod config_manager;
mod api_proxy;
mod knowledge_graph;
mod knowledge_optimizer;

use child_process::ChildProcessManager;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tracing::info;

pub struct AppState {
    pub process_manager: Arc<ChildProcessManager>,
}

fn main() {
    run();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "openfang_tauri_gui=info,tauri=info".into()),
        )
        .init();

    info!("启动 OpenFang 中文管家...");

    let process_manager = Arc::new(ChildProcessManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            process_manager: process_manager.clone(),
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_backend,
            commands::stop_backend,
            commands::restart_backend,
            commands::list_agent_templates,
            commands::load_template_toml,
            commands::get_knowledge_graph_data,
            commands::start_knowledge_optimization,
            commands::fetch_models,
        ])
        .setup(move |app| {
            let manager = process_manager.clone();
            let app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                match manager.start().await {
                    Ok(_) => {
                        info!("openfang.exe 子进程已启动");
                        let _ = app_handle.emit("backend-status-change", "running");
                    }
                    Err(e) => {
                        tracing::error!("启动 openfang.exe 失败: {e}");
                        let _ = app_handle.emit("backend-status-change", "stopped");
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("构建 Tauri 应用失败")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                info!("应用退出，停止子进程...");
                let state = app_handle.state::<AppState>();
                let _ = state.process_manager.stop();
            }
        });
}
