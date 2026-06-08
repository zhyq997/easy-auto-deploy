# 远程备份保留策略实现计划

> **面向 AI 代理的工作者：** 使用 test-driven-development 按以下步骤实施。

**目标：** 新版本部署成功后，远程 `backups` 目录只保留最近 5 个 ZIP 压缩包。

**架构：** 将保留规则放入独立纯函数模块，由 CLI 获取按修改时间倒序的备份列表并通过 SFTP 删除超出数量的文件。发布流程仅在解压成功后调用清理，回滚流程保持不变。

**技术栈：** Node.js ESM、Node.js 内置测试框架、node-ssh/SFTP。

---

### 任务 1：定义并测试保留规则

**文件：**
- 创建：`backup-retention.mjs`
- 创建：`test/backup-retention.test.mjs`
- 修改：`package.json`

- [x] 编写测试：4 个和 5 个 ZIP 返回空删除列表；6 个和 7 个 ZIP 仅返回第 6 个及之后的文件。
- [x] 运行 `pnpm test`，确认因模块或导出不存在而失败。
- [x] 实现 `getBackupsToDelete(backups, limit = 5)`。
- [x] 运行 `pnpm test`，确认全部通过。

### 任务 2：接入远程部署流程

**文件：**
- 修改：`index.mjs`

- [x] 新增 `cleanupRemoteBackups()`，复用按时间倒序的 `getRemoteBackups()`。
- [x] 通过 `ssh.withSFTP()` 获取客户端，逐个删除待清理 ZIP。
- [x] 在 `deployRemote()` 成功后调用清理，仅发布新版本时启用。
- [x] 清理失败时抛出错误，由现有发布错误处理报告。

### 任务 3：验证

**文件：**
- 检查：`backup-retention.mjs`
- 检查：`test/backup-retention.test.mjs`
- 检查：`index.mjs`
- 检查：`package.json`

- [x] 运行 `pnpm test`。
- [x] 运行 `node --check index.mjs` 和 `node --check backup-retention.mjs`。
- [x] 运行 `git diff --check` 并审阅最终差异。
