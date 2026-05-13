//! 读写 ~/.openfang/config.toml 配置文件。

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

/// 读取模型配置。
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

    // api_key 使用固定的环境变量名
    let api_key = std::env::var("OPENFANG_TAURI_API_KEY").unwrap_or_default();

    let model_name = default
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("llama3.2:1b")
        .to_string();

    Ok(ModelConfig {
        provider,
        base_url,
        api_key,
        model_name,
    })
}

/// 写入模型配置。
/// 将 provider, base_url, model_name 写入 config.toml，
/// API key 通过环境变量 OPENFANG_TAURI_API_KEY 注入。
pub fn write_config(cfg: &ModelConfig) -> anyhow::Result<()> {
    // 设置进程环境变量（用于子进程）
    std::env::set_var("OPENFANG_TAURI_API_KEY_ENABLED", "1");
    std::env::set_var("OPENFANG_TAURI_API_KEY", &cfg.api_key);
    std::env::set_var("OPENFANG_TAURI_PROVIDER", &cfg.provider);

    // 也写入 .env 文件，方便 openfang 从文件读取
    let env_path = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".openfang")
        .join(".env");

    let env_content = match cfg.provider.to_lowercase().as_str() {
        "openai" => format!("OPENAI_API_KEY={}", cfg.api_key),
        "anthropic" => format!("ANTHROPIC_API_KEY={}", cfg.api_key),
        "gemini" => format!("GEMINI_API_KEY={}", cfg.api_key),
        "groq" => format!("GROQ_API_KEY={}", cfg.api_key),
        _ => format!("OPENFANG_TAURI_API_KEY={}", cfg.api_key),
    };

    if !cfg.api_key.is_empty() {
        let parent = env_path.parent().unwrap();
        std::fs::create_dir_all(parent)?;
        std::fs::write(&env_path, env_content)?;
    }

    // 写入 config.toml (不含 api_key)
    let toml_content = format!(
        r#"[default_model]
provider = "{}"
base_url = "{}"
model = "{}"
"#,
        cfg.provider, cfg.base_url, cfg.model_name
    );

    let path = config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, toml_content)?;

    info!("配置已保存: provider={}, model={}", cfg.provider, cfg.model_name);
    Ok(())
}
