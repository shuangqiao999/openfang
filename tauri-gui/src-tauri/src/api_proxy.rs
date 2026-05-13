//! HTTP 代理 — 转发前端请求到 openfang.exe 的 API，并桥接 SSE 流式响应。

use futures_util::StreamExt;
use serde_json::Value;
use tauri::Emitter;
use tracing::{error, info, warn};

/// 通用 HTTP 代理请求。
pub async fn proxy_request(
    method: &str,
    path: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let url = format!("http://localhost:4200{}", path);

    let response = match method.to_uppercase().as_str() {
        "GET" => client.get(&url).send().await,
        "POST" => client
            .post(&url)
            .json(&body.unwrap_or(Value::Null))
            .send()
            .await,
        "DELETE" => client.delete(&url).send().await,
        _ => return Err(format!("不支持的 HTTP 方法: {}", method)),
    };

    let resp = response.map_err(|e| format!("HTTP 请求失败: {e}"))?;
    let status = resp.status();

    let json: Value = resp.json().await.map_err(|e| format!("解析响应失败: {e}"))?;

    if status.is_success() {
        Ok(json)
    } else {
        Err(format!(
            "HTTP {}: {}",
            status,
            json.get("error")
                .and_then(|v| v.as_str())
                .unwrap_or("未知错误")
        ))
    }
}

/// 发送流式消息 — 通过 SSE 桥接。
/// 向 openfang.exe 发起 SSE 请求，将每个事件通过 Tauri 事件发送到前端。
pub async fn send_message_stream(
    agent_id: &str,
    message: &str,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let url = format!(
        "http://localhost:4200/api/agents/{}/message/stream",
        agent_id
    );

    info!("发起流式请求: {} -> {}", message, url);

    let response = client
        .post(&url)
        .json(&serde_json::json!({
            "message": message,
        }))
        .send()
        .await
        .map_err(|e| format!("流式请求失败: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }

    let mut stream = response.bytes_stream();
    let mut current_event = String::new();
    let mut current_data = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("流读取错误: {e}"))?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            if line.starts_with("event: ") {
                current_event = line[7..].trim().to_string();
            } else if line.starts_with("data: ") {
                current_data = line[6..].to_string();
            } else if line.is_empty() && !current_event.is_empty() {
                // 空行表示一个事件结束
                let payload = match current_event.as_str() {
                    "chunk" => {
                        match serde_json::from_str::<Value>(&current_data) {
                            Ok(v) => serde_json::json!({
                                "type": "chunk",
                                "data": v,
                            }),
                            Err(e) => {
                                warn!("解析 chunk 数据失败: {e}");
                                continue;
                            }
                        }
                    }
                    "tool_use" => {
                        serde_json::json!({
                            "type": "tool_use",
                            "data": current_data,
                        })
                    }
                    "tool_result" => {
                        serde_json::json!({
                            "type": "tool_result",
                            "data": current_data,
                        })
                    }
                    "phase" => {
                        serde_json::json!({
                            "type": "phase",
                            "data": current_data,
                        })
                    }
                    "done" => {
                        match serde_json::from_str::<Value>(&current_data) {
                            Ok(v) => serde_json::json!({
                                "type": "done",
                                "data": v,
                            }),
                            Err(e) => {
                                warn!("解析 done 数据失败: {e}");
                                serde_json::json!({
                                    "type": "done",
                                    "data": { "done": true },
                                })
                            }
                        }
                    }
                    _ => {
                        serde_json::json!({
                            "type": current_event,
                            "data": current_data,
                        })
                    }
                };

                if let Err(e) = app_handle.emit("message-chunk", &payload) {
                    error!("发送 message-chunk 事件失败: {e}");
                }

                // done 事件发送后结束
                if current_event == "done" {
                    info!("流式消息完成 (agent={})", agent_id);
                    return Ok(());
                }

                current_event.clear();
                current_data.clear();
            }
        }
    }

    // 如果流结束了但没有收到 done 事件，也发送一个完成事件
    if !current_event.is_empty() {
        let payload = serde_json::json!({
            "type": "done",
            "data": { "done": true },
        });
        let _ = app_handle.emit("message-chunk", &payload);
    }

    Ok(())
}

/// 从模型提供商的 API 获取可用模型列表。
/// 支持 Ollama（/api/tags）和 OpenAI 兼容（/models）接口。
pub async fn get_model_list(
    provider: &str,
    base_url: &str,
    api_key: Option<String>,
) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();

    match provider {
        "ollama" => {
            // Ollama 使用 /api/tags 接口，地址需要去掉 /v1 后缀
            let url = format!("{}/api/tags", base_url.trim_end_matches("/v1"));
            let resp = client
                .get(&url)
                .send()
                .await
                .map_err(|e| format!("Ollama 请求失败: {e}"))?;
            let json: Value = resp.json().await.map_err(|e| format!("解析响应失败: {e}"))?;
            let models = json["models"]
                .as_array()
                .ok_or("Ollama 返回格式异常，缺少 models 字段")?;
            Ok(models
                .iter()
                .filter_map(|m| m["name"].as_str().map(String::from))
                .collect())
        }
        "openai" | "openai_compatible" | "groq" | "lmstudio" => {
            let url = format!("{}/models", base_url.trim_end_matches('/'));
            let mut req = client.get(&url);
            if let Some(key) = &api_key {
                if !key.is_empty() {
                    req = req.bearer_auth(key);
                }
            }
            let resp = req
                .send()
                .await
                .map_err(|e| format!("请求模型列表失败: {e}"))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("HTTP {}: {}. 请检查 API 地址和密钥是否正确", status, body));
            }

            let json: Value = resp.json().await.map_err(|e| format!("解析响应失败: {e}"))?;
            let models = json["data"]
                .as_array()
                .ok_or("返回格式异常，缺少 data 字段")?;
            Ok(models
                .iter()
                .filter_map(|m| m["id"].as_str().map(String::from))
                .collect())
        }
        "anthropic" => {
            // Anthropic 没有公开的模型列表 API，返回常用模型
            Ok(vec![
                "claude-sonnet-4-20250514".to_string(),
                "claude-3-opus-20240229".to_string(),
                "claude-3-5-sonnet-20241022".to_string(),
                "claude-3-5-haiku-20241022".to_string(),
                "claude-3-haiku-20240307".to_string(),
            ])
        }
        _ => Err(format!("提供商 \"{}\" 不支持拉取模型列表", provider)),
    }
}
