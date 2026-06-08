# 模块化架构实现计划

> **面向 AI 代理的工作者：** 使用 test-driven-development 在当前工作区逐任务实施。

**目标：** 将单文件部署 CLI 拆分为可测试模块，并修正远程退出码、进程退出码和备份列表 shell 依赖。

**架构：** 入口只组装依赖；CLI 负责交互；部署服务负责编排；配置、归档和 SSH 分别封装基础设施。部署服务通过依赖注入接受适配器，测试使用内存替身验证行为和错误传播。

**技术栈：** Node.js ESM、Node.js 内置测试框架、node-ssh、archiver、prompts。

---

### 任务 1：配置模块

**文件：**
- 创建：`src/config.mjs`
- 创建：`test/config.test.mjs`

- [x] 测试有效配置可被规范化。
- [x] 测试缺失必填字段时抛出清晰错误。
- [x] 测试 `/`、`.` 和空部署目录被拒绝。
- [x] 测试字符串形式的 `privateKey` 被兼容为 `privateKeyPath`。
- [x] 运行配置测试确认红灯。
- [x] 实现 `validateConfig()` 和 `loadConfig()`。
- [x] 运行配置测试确认绿灯。

### 任务 2：部署服务

**文件：**
- 创建：`src/deploy-service.mjs`
- 创建：`test/deploy-service.test.mjs`
- 移动：`backup-retention.mjs` 到 `src/backup-retention.mjs`
- 修改：`test/backup-retention.test.mjs`

- [x] 测试发布按构建、压缩、连接、上传、部署、裁剪顺序执行。
- [x] 测试发布失败仍清理本地文件并释放连接。
- [x] 测试回滚部署指定版本但不裁剪备份。
- [x] 运行部署服务测试确认红灯。
- [x] 实现依赖注入式 `createDeployService()`。
- [x] 运行部署服务测试确认绿灯。

### 任务 3：归档与 SSH 适配器

**文件：**
- 创建：`src/archive.mjs`
- 创建：`src/ssh-client.mjs`
- 创建：`test/ssh-client.test.mjs`

- [x] 测试 SFTP 备份列表仅返回 ZIP 且按修改时间倒序。
- [x] 测试远程部署命令非零退出码抛错。
- [x] 运行 SSH 测试确认红灯。
- [x] 实现归档适配器。
- [x] 实现 SSH 适配器及远程退出码检查。
- [x] 运行相关测试确认绿灯。

### 任务 4：CLI 与入口

**文件：**
- 创建：`src/cli.mjs`
- 创建：`test/cli.test.mjs`
- 重写：`index.mjs`

- [x] 测试发布选择调用 `deploy()`。
- [x] 测试回滚选择版本并调用 `rollback(version)`。
- [x] 测试服务错误返回失败状态。
- [x] 运行 CLI 测试确认红灯。
- [x] 实现 `runCli()` 和依赖组装。
- [x] 使用直接执行守卫重写 `index.mjs`。
- [x] 运行测试确认绿灯。

### 任务 5：文档与验证

**文件：**
- 修改：`README.md`
- 修改：`package.json`

- [x] 更新私钥参数和模块结构说明。
- [x] 运行 `pnpm test`。
- [x] 对全部 `.mjs` 运行 `node --check`。
- [x] 运行 `git diff --check`。
- [x] 审阅最终差异，确认保留原有未提交功能。
