# OpenFang 中文管家 (OpenFang Tauri GUI)

基于 Tauri 2.0 + React + TypeScript + Ant Design 构建的 OpenFang 桌面管理器。

> 注意：这是一个独立的桌面应用，用于管理 OpenFang 后端。你需要单独安装 OpenFang CLI 或下载 `openfang.exe`。

## 功能

- **全中文界面**：所有 UI 文字均为简体中文
- **Agent 管理**：创建、删除、切换智能体，内置 31 个 Agent 模板
- **对话互动**：通过聊天界面与 Agent 对话，支持流式输出和 Markdown 渲染
- **模型配置**：可视化配置本地模型 (Ollama) 或云模型 (OpenAI, Anthropic)
- **后端管理**：自动启动/停止 OpenFang 后端，健康状态监控

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Tauri 2.0 (Rust + WebView2) |
| 前端 | React 18 + TypeScript + Vite |
| UI 组件 | Ant Design 5 |
| 状态管理 | Zustand |
| 后端通信 | Tauri invoke + reqwest HTTP 代理 |

## 架构

```
┌─────────────────────────────────────┐
│  React 前端 (WebView)               │
│  invoke() ←→ listen()              │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Tauri Rust 后端                     │
│  • 子进程管理                       │
│  • 配置读写                         │
│  • HTTP 代理 + SSE 桥接             │
└──────────────┬──────────────────────┘
               │ HTTP (localhost:4200)
┌──────────────▼──────────────────────┐
│  openfang.exe 子进程                 │
└─────────────────────────────────────┘
```

## 开发

### 前置条件

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) 1.75+
- [OpenFang](https://github.com/RightNow-AI/openfang) CLI（或 openfang.exe）

### 启动开发环境

```bash
# 安装前端依赖
npm install

# 启动 Tauri 开发模式（自动启动 Vite + Tauri）
npm run tauri dev
```

开发模式下，需要确保 `openfang.exe` 位于应用可执行文件同目录的 `backend/` 下，或设置环境变量 `OPENFANG_EXE_PATH`。

### 构建生产版本

```bash
# 构建前端
npm run build

# 构建 Tauri 应用（生成 NSIS 安装包）
npm run tauri build
```

安装包位于 `src-tauri/target/release/bundle/nsis/`。

## 项目结构

```
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── main.rs         # Tauri 入口
│   │   ├── child_process.rs # 子进程管理
│   │   ├── config_manager.rs # 配置读写
│   │   ├── api_proxy.rs    # HTTP 代理 + SSE 桥接
│   │   └── commands.rs     # Tauri 命令
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                    # React 前端
│   ├── components/         # UI 组件
│   ├── pages/              # 页面
│   ├── services/           # API 封装
│   ├── stores/             # 状态管理
│   └── types/              # 类型定义
├── agent-templates/        # 31 个内置 Agent 模板
├── index.html
├── package.json
└── vite.config.ts
```

## 配置说明

模型配置保存在 `~/.openfang/config.toml`，API 密钥通过环境变量注入子进程，不会写入配置文件。

支持的模型提供商：
- **Ollama** — 本地运行，默认 `http://localhost:11434/v1`
- **OpenAI** — 云服务，需要 API Key
- **Anthropic** — 云服务，需要 API Key
- **OpenAI 兼容** — 兼容 OpenAI API 的本地/云服务（如 LM Studio）

## License

MIT
