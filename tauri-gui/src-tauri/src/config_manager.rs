//! 读写 ~/.openfang/config.toml 配置文件。
//! api_key 同时写入 config.toml（持久化）和 .env 文件（子进程注入）。

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub model_name: String,
}

impl Default for ModelConfig {
    fn default() -> Self {
        Self {
            provider: "ollama".to_string(),
            base_url: "http://localhost:11434/v1".to_string(),
            api_key: String::new(),
            model_name: "llama3.2:1b".to_string(),
        }
    }
}

/// 获取配置文件路径: ~/.openfang/config.toml
pub fn config_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".openfang")
        .join("config.toml")
}

/// .env 文件路径
fn dotenv_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".openfang")
        .join(".env")
}

/// 从 .env 文件中读取指定 key 的值
fn read_env_file_key(key: &str) -> Option<String> {
    let path = dotenv_path();
    if !path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&path).ok()?;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = trimmed.split_once('=') {
            let k = k.trim();
            let mut v = v.trim().to_string();
            if ((v.starts_with('"') && v.ends_with('"')) || (v.starts_with('\'') && v.ends_with('\''))) && v.len() >= 2
            {
                v = v[1..v.len() - 1].to_string();
            }
            if k == key && !v.is_empty() {
                return Some(v);
            }
        }
    }
    None
}

/// 读取模型配置。
/// api_key 读取优先级：环境变量 > .env 文件 > config.toml 中的 api_key 字段
pub fn read_config() -> anyhow::Result<ModelConfig> {
    let path = config_path();
    if !path.exists() {
        return Ok(ModelConfig::default());
    }

    let contents = std::fs::read_to_string(&path)
        .map_err(|e| anyhow::anyhow!("读取配置文件失败: {e}"))?;

    let value: toml::Value =
        toml::from_str(&contents).map_err(|e| anyhow::anyhow!("解析配置文件失败: {e}"))?;

    let default = value
        .get("default_model")
        .ok_or_else(|| anyhow::anyhow!("配置文件中未找到 [default_model] 节"))?;

    let provider = default
        .get("provider")
        .and_then(|v| v.as_str())
        .unwrap_or("ollama")
        .to_string();

    let base_url = default
        .get("base_url")
        .and_then(|v| v.as_str())
        .unwrap_or("http://localhost:11434/v1")
        .to_string();

    let model_name = default
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("llama3.2:1b")
        .to_string();

    // api_key 读取优先级:
    // 1. 当前进程环境变量 (子进程注入场景)
    // 2. .env 文件中的 PROVIDER_API_KEY
    // 3. config.toml 中 api_key 字段
    let api_key = std::env::var("OPENFANG_TAURI_API_KEY")
        .ok()
        .or_else(|| {
            match provider.to_lowercase().as_str() {
                "openai" => read_env_file_key("OPENAI_API_KEY"),
                "anthropic" => read_env_file_key("ANTHROPIC_API_KEY"),
                "gemini" => read_env_file_key("GEMINI_API_KEY"),
                "groq" => read_env_file_key("GROQ_API_KEY"),
                _ => read_env_file_key("OPENFANG_TAURI_API_KEY"),
            }
        })
        .or_else(|| {
            default
                .get("api_key")
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .map(String::from)
        })
        .unwrap_or_default();

    Ok(ModelConfig {
        provider,
        base_url,
        api_key,
        model_name,
    })
}

/// 写入模型配置。
/// 1. 将完整配置（含 api_key）写入 config.toml
/// 2. 将 api_key 写入 .env 文件（OpenFang 启动时自动加载）
/// 3. 设置进程环境变量（当前进程 + 子进程继承）
pub fn write_config(cfg: &ModelConfig) -> anyhow::Result<()> {
    // 写入 config.toml（含 api_key，确保持久化回读）
    let toml_content = format!(
        r#"[default_model]
provider = "{}"
base_url = "{}"
model = "{}"
api_key = "{}"
"#,
        cfg.provider, cfg.base_url, cfg.model_name, cfg.api_key
    );

    let path = config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, toml_content)?;

    // 写入 .env 文件（OpenFang 启动时自动加载）
    if !cfg.api_key.is_empty() {
        let env_path = dotenv_path();
        if let Some(parent) = env_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let env_key = match cfg.provider.to_lowercase().as_str() {
            "openai" => "OPENAI_API_KEY",
            "anthropic" => "ANTHROPIC_API_KEY",
            "gemini" => "GEMINI_API_KEY",
            "groq" => "GROQ_API_KEY",
            _ => "OPENFANG_TAURI_API_KEY",
        };

        // 读取现有 .env，更新/追加 key
        let existing = if env_path.exists() {
            std::fs::read_to_string(&env_path).unwrap_or_default()
        } else {
            String::new()
        };

        let mut new_lines: Vec<String> = Vec::new();
        let mut found = false;
        for line in existing.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with(env_key) && trimmed.contains('=') {
                new_lines.push(format!("{}={}", env_key, cfg.api_key));
                found = true;
            } else if !trimmed.is_empty() || !new_lines.is_empty() {
                new_lines.push(line.to_string());
            }
        }
        if !found {
            new_lines.push(format!("{}={}", env_key, cfg.api_key));
        }

        std::fs::write(&env_path, new_lines.join("\n") + "\n")?;
    }

    // 设置进程环境变量（用于当前及子进程）
    std::env::set_var("OPENFANG_TAURI_API_KEY_ENABLED", "1");
    std::env::set_var("OPENFANG_TAURI_API_KEY", &cfg.api_key);
    std::env::set_var("OPENFANG_TAURI_PROVIDER", &cfg.provider);

    info!(
        "配置已保存至 {} : provider={}, model={}",
        path.display(),
        cfg.provider,
        cfg.model_name
    );
    Ok(())
}
