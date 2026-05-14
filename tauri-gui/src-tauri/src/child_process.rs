//! 管理 openfang.exe 子进程的启动、停止和健康检查。

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tracing::{info, warn};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub struct ChildProcessManager {
    process: Mutex<Option<Child>>,
}

impl ChildProcessManager {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
        }
    }

    /// 获取 openfang.exe 的路径。
    /// 查找顺序：
    /// 1. 环境变量 OPENFANG_EXE_PATH
    /// 2. 开发模式：monorepo 的 target/ 目录
    /// 3. 生产模式：app 可执行文件同目录下的 backend/openfang.exe
    /// 4. Tauri 资源目录下的 backend/openfang.exe
    fn find_exe() -> Option<std::path::PathBuf> {
        // 1. 环境变量
        if let Ok(path) = std::env::var("OPENFANG_EXE_PATH") {
            let p = std::path::PathBuf::from(&path);
            if p.exists() {
                return Some(p);
            }
        }

        // 2. 开发模式：从 monorepo target/ 目录查找
        if let Ok(cwd) = std::env::current_dir() {
            for subdir in &["release", "debug"] {
                let dev_path = cwd
                    .join("..")
                    .join("..")
                    .join("target")
                    .join(subdir)
                    .join("openfang.exe");
                if dev_path.exists() {
                    return dev_path.canonicalize().ok();
                }
            }
        }

        // 3. 生产模式：与当前 exe 同目录
        if let Ok(current) = std::env::current_exe() {
            if let Some(dir) = current.parent() {
                for candidate in &[
                    dir.join("backend").join("openfang.exe"),
                    dir.join("openfang.exe"),
                ] {
                    if candidate.exists() {
                        return Some(candidate.clone());
                    }
                }
            }
        }

        // 4. Tauri 资源目录（打包后）
        if let Ok(resource_dir) = std::env::var("TAURI_RESOURCE_DIR") {
            let p = std::path::PathBuf::from(&resource_dir)
                .join("backend")
                .join("openfang.exe");
            if p.exists() {
                return Some(p);
            }
        }

        None
    }

    /// 启动 openfang.exe 子进程，设置环境变量（API keys），等待健康检查通过。
    pub async fn start(&self) -> anyhow::Result<()> {
        let exe_path = Self::find_exe().ok_or_else(|| {
            anyhow::anyhow!("未找到 openfang.exe，请将 openfang.exe 放在应用同目录的 backend/ 下")
        })?;

        info!("启动子进程: {}", exe_path.display());

        // 构建环境变量 — 完全静默，无控制台窗口
        let mut cmd = Command::new(&exe_path);
        cmd.stdout(Stdio::null())
            .stderr(Stdio::null())
            .stdin(Stdio::null());

        #[cfg(windows)]
        {
            // CREATE_NO_WINDOW (0x08000000) — 不创建控制台窗口
            // DETACHED_PROCESS (0x00000008) — 脱离父进程控制台
            cmd.creation_flags(0x08000000 | 0x00000008);
        }

        // 注入 API key 环境变量（如果存在）
        if let Ok(enabled) = std::env::var("OPENFANG_TAURI_API_KEY_ENABLED") {
            if enabled == "1" {
                if let Ok(key) = std::env::var("OPENFANG_TAURI_API_KEY") {
                    cmd.env("OPENFANG_TAURI_API_KEY", &key);
                }
                if let Ok(provider) = std::env::var("OPENFANG_TAURI_PROVIDER") {
                    match provider.to_lowercase().as_str() {
                        "openai" => {
                            if let Ok(k) = std::env::var("OPENFANG_TAURI_API_KEY") {
                                cmd.env("OPENAI_API_KEY", &k);
                            }
                        }
                        "anthropic" => {
                            if let Ok(k) = std::env::var("OPENFANG_TAURI_API_KEY") {
                                cmd.env("ANTHROPIC_API_KEY", &k);
                            }
                        }
                        "gemini" => {
                            if let Ok(k) = std::env::var("OPENFANG_TAURI_API_KEY") {
                                cmd.env("GEMINI_API_KEY", &k);
                            }
                        }
                        "groq" => {
                            if let Ok(k) = std::env::var("OPENFANG_TAURI_API_KEY") {
                                cmd.env("GROQ_API_KEY", &k);
                            }
                        }
                        _ => {}
                    }
                }
            }
        }

        let child = cmd.spawn().map_err(|e| {
            anyhow::anyhow!("无法启动 openfang.exe: {e}")
        })?;

        {
            let mut guard = self.process.lock().unwrap();
            *guard = Some(child);
        }

        // 等待健康检查
        self.wait_healthy().await?;

        Ok(())
    }

    /// 停止子进程。
    pub fn stop(&self) -> anyhow::Result<()> {
        let mut guard = self.process.lock().unwrap();
        if let Some(mut child) = guard.take() {
            info!("正在停止 openfang.exe 子进程...");
            let _ = child.kill();
            let _ = child.wait();
            info!("子进程已停止");
        }
        Ok(())
    }

    /// 重启子进程。
    pub async fn restart(&self) -> anyhow::Result<()> {
        self.stop()?;
        self.start().await
    }

    /// 轮询健康检查端点，超时 15 秒。
    async fn wait_healthy(&self) -> anyhow::Result<()> {
        let client = reqwest::Client::new();
        for i in 0..30 {
            tokio::time::sleep(Duration::from_millis(500)).await;
            match client
                .get("http://localhost:4200/api/health")
                .timeout(Duration::from_secs(3))
                .send()
                .await
            {
                Ok(resp) if resp.status().is_success() => {
                    info!("openfang.exe 健康检查通过 (尝试 {})", i + 1);
                    return Ok(());
                }
                Ok(resp) => {
                    warn!(
                        "健康检查返回非成功状态: {} (尝试 {})",
                        resp.status(),
                        i + 1
                    );
                }
                Err(_) => {
                    // 继续重试
                }
            }
        }
        anyhow::bail!("openfang.exe 在 15 秒内未就绪")
    }

    /// 同步健康检查（用于 Tauri 命令）。
    pub async fn check_health(&self) -> bool {
        let client = reqwest::Client::new();
        match client
            .get("http://localhost:4200/api/health")
            .timeout(Duration::from_secs(3))
            .send()
            .await
        {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }
}
