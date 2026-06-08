# 🚀 Easy-Auto-Deploy-CLI

一个轻量级、交互式的前端自动化部署工具。
支持 **一键打包发布**、**上传进度条**、**历史版本备份** 以及 **秒级回滚**。

基于 Node.js 开发，适用于 Vue, React, Angular 等所有需要静态资源部署的前端项目。

[github 仓库链接](https://github.com/zhyq997/easy-auto-deploy)

## ✨ 主要特性

- 📦 **自动构建**：自动执行本地 `npm run build` 命令。
- 🤐 **自动压缩**：将构建产物压缩为 zip 包（支持高压缩比）。
- 🚀 **极速上传**：通过 SSH 传输，带有实时进度条显示。
- 💾 **自动备份**：部署前自动将新版本存入服务器 `backups` 目录，仅保留最近 5 个 ZIP 压缩包。
- 🔙 **版本回滚**：支持交互式选择历史版本，秒级回滚线上环境。
- 🧹 **自动清理**：自动清理本地、远程临时文件和过期备份，保持整洁。
- 💻 **多平台支持**：兼容 Windows (Powershell/CMD/Git Bash), macOS, Linux。

## 🛠️ 安装

### 方式一：从 npm 安装 (推荐)

_(假设你已经发布到 npm，如果未发布请使用方式二)_

```bash
npm i easy-auto-deploy-cli -g
```

### 方式二：本地开发模式

如果你下载了源码，想在本地调试使用：

```bash
# 进入工具目录
cd easy-auto-deploy-cli

# 安装依赖
npm install

# 链接到全局命令
npm link
```

## ⚙️ 项目配置

在你的业务项目（如 Vue 项目）根目录下，创建一个名为 `deploy.config.js` 的文件。

**⚠️ 注意：请确保该文件包含敏感信息（密码/秘钥），建议在 `.gitignore` 中忽略此文件。**

```javascript
// deploy.config.js
module.exports = {
  // 本地配置
  local: {
    // 打包命令，例如 'npm run build:prod' 或 'yarn build'
    buildCommand: "npm run build:prod",

    // 打包生成的目录，通常是 'dist' 或 'dist-pro'
    // 请确保这与你 webpack/vite 配置的输出目录一致
    distPath: "./dist",
  },

  // 服务器配置
  server: {
    host: "192.168.1.100", // 服务器 IP
    port: 22, // SSH 端口
    username: "root", // 登录用户名

    // 认证方式一：使用密码
    password: "your_password",

    // 认证方式二：使用私钥 (推荐)
    // privateKeyPath: "C:/Users/Admin/.ssh/id_rsa",

    // 服务器上的部署目录 (Nginx 指向的目录)
    webDir: "/www/server/nginx/html/my-project",
  },
};
```

## 🚀 使用指南

在项目根目录下（即 `deploy.config.js` 所在目录），打开终端运行命令：

```bash
# 运行部署工具
easy-deploy
```

_(注：`easy-deploy` 是你在 package.json `bin` 中配置的命令名，根据实际情况调整)_

### 交互菜单

工具启动后，会出现以下交互菜单：

1.  **🚀 发布新版本 (Build & Deploy)**
    - 执行本地打包 -> 压缩 -> 上传 -> 备份 -> 解压覆盖 -> 清理过期备份。
    - 服务器上的旧文件会被清理（`backups` 目录除外）。
2.  **🔙 版本回滚 (Rollback)**

    - 读取服务器 `backups` 目录下的历史版本列表。
    - 选择一个时间节点，确认后立即恢复该版本。

3.  **❌ 退出**

## 📂 服务器目录结构说明

部署完成后，你的服务器目录结构如下所示：

```text
/www/server/nginx/html/my-project
├── assets/             # 当前运行的静态资源
├── index.html          # 当前运行的入口文件
├── backups/            # ⚡️ 自动生成的备份目录
│   ├── dist_20240105_100000.zip
│   ├── dist_20240105_143000.zip
│   └── ...
└── ...
```

## 🧱 代码结构

```text
index.mjs                    # 可执行入口与真实依赖组装
src/
├── archive.mjs              # 本地构建、压缩和临时文件清理
├── backup-retention.mjs     # 备份保留规则
├── cli.mjs                  # 交互菜单和终端展示
├── config.mjs               # 配置加载、规范化与安全校验
├── deploy-service.mjs       # 发布和回滚业务编排
└── ssh-client.mjs           # SSH、SFTP 和远程命令封装
test/                        # Node.js 内置测试框架测试
```

入口文件被其他模块导入时不会自动执行 CLI。部署服务通过适配器接收本地归档和远程连接能力，因此无需真实服务器即可测试发布、回滚及失败清理流程。

## ❓ 常见问题 (FAQ)

**Q1: 报错 `unzip: command not found`**

- **原因**: 服务器未安装解压工具。
- **解决**:
  - CentOS: `yum install unzip -y`
  - Ubuntu: `apt-get install unzip -y`

**Q2: 报错 `Timed out while waiting for handshake`**

- **原因**: SSH 连接超时，可能是网络不通或 IP/端口错误。
- **解决**: 检查 VPN 是否开启，IP 是否正确，或者在代码中增加 `readyTimeout` 时间。

**Q3: 为什么 Windows 下无法通过方向键选择菜单？**

- **解决**: 本工具已使用 `prompts` 库优化了 Windows 兼容性。请确保不要使用过旧的 CMD，推荐使用 PowerShell 或 VS Code 内置终端。

**Q4: 上传速度很慢？**

- **解决**: 请检查 `deploy.config.js` 中的 `distPath` 是否配置正确。如果配置成了根目录 `./`，会导致将 `node_modules` 也打包上传，导致文件巨大。

## 📄 License

ISC / MIT
