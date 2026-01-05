#!/usr/bin/env node

import { NodeSSH } from "node-ssh";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import ora from "ora";
import chalk from "chalk";
import cliProgress from "cli-progress";
import prompts from "prompts"; // 修改：替换 inquirer 为 prompts
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createRequire } from "module";

// --- 上下文配置 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const currentDir = process.cwd();

// --- 读取配置文件 ---
const require = createRequire(import.meta.url);
const configPath = path.join(currentDir, "deploy.config.js");

if (!fs.existsSync(configPath)) {
  console.error(
    chalk.red("\n❌ 错误：当前目录下未找到 deploy.config.js 配置文件！")
  );
  console.log(chalk.yellow("请在项目根目录创建 deploy.config.js。"));
  process.exit(1);
}

const config = require(configPath);

const ssh = new NodeSSH();
const localDistDir = path.resolve(currentDir, config.local.distPath);

function getTimeString() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

const BACKUP_DIR_NAME = "backups";

/**
 * 1. 本地打包
 */
async function buildProject() {
  console.log(
    chalk.blue("---------------------------------------------------")
  );
  console.log(chalk.blue(`正在执行本地打包: ${config.local.buildCommand}`));
  console.log(
    chalk.blue("---------------------------------------------------")
  );

  return new Promise((resolve, reject) => {
    const [cmd, ...args] = config.local.buildCommand.split(" ");
    const build = spawn(cmd, args, {
      stdio: "inherit",
      shell: true,
      cwd: currentDir,
    });

    build.on("close", (code) => {
      if (code === 0) {
        console.log(chalk.green("\nBuild 完成！"));
        resolve();
      } else {
        reject(new Error(`打包失败，退出码: ${code}`));
      }
    });
    build.on("error", (err) => reject(err));
  });
}

/**
 * 2. 压缩文件
 */
async function zipProject(zipName) {
  if (!fs.existsSync(localDistDir)) {
    console.error(chalk.red(`\n❌ 错误：找不到打包目录 "${localDistDir}"`));
    process.exit(1);
  }

  const spinner = ora("正在压缩文件...").start();
  const localZipPath = path.resolve(currentDir, zipName);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(localZipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      spinner.succeed(
        `压缩完成: ${zipName} (${(archive.pointer() / 1024 / 1024).toFixed(
          2
        )} MB)`
      );
      resolve(localZipPath);
    });
    archive.on("error", (err) => {
      spinner.fail("压缩失败！");
      reject(err);
    });
    archive.pipe(output);
    archive.directory(localDistDir, false);
    archive.finalize();
  });
}

/**
 * 3. 连接服务器
 */
async function connectServer() {
  const spinner = ora("正在连接服务器...").start();
  try {
    await ssh.connect({ ...config.server, readyTimeout: 20000 });
    spinner.succeed("服务器连接成功！");
  } catch (error) {
    spinner.fail("服务器连接失败！");
    console.error(chalk.red("连接错误详情:"), error);
    process.exit(1);
  }
}

/**
 * 4. 上传文件
 */
async function uploadFile(localZipPath, remoteZipPath) {
  console.log(chalk.cyan("开始上传文件..."));
  const progressBar = new cliProgress.SingleBar({
    format:
      "上传进度 |" +
      chalk.cyan("{bar}") +
      "| {percentage}% || {value}/{total} Bytes",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  });

  const stat = fs.statSync(localZipPath);
  progressBar.start(stat.size, 0);

  try {
    const remoteDir = path.dirname(remoteZipPath);
    await ssh.execCommand(`mkdir -p ${remoteDir}`);
    await ssh.putFile(localZipPath, remoteZipPath, null, {
      step: (total_transferred) => progressBar.update(total_transferred),
    });
    progressBar.stop();
    console.log(chalk.green("\n文件上传成功！"));
  } catch (error) {
    progressBar.stop();
    console.log(chalk.red("\n文件上传失败！"));
    throw error;
  }
}

/**
 * 5. 远程部署
 */
async function deployRemote(targetZipName) {
  const spinner = ora("正在清理旧文件并解压新版本...").start();
  try {
    const { webDir } = config.server;
    const backupDir = path.posix.join(webDir, BACKUP_DIR_NAME);
    const targetZipPath = path.posix.join(backupDir, targetZipName);

    const cleanCommand = `find . -maxdepth 1 ! -name "${BACKUP_DIR_NAME}" ! -name "." -exec rm -rf {} +`;
    const cmd = `cd ${webDir} && ${cleanCommand} && unzip -o ${targetZipPath}`;

    const result = await ssh.execCommand(cmd);
    if (result.stderr && !result.stderr.includes("dismatch")) {
      console.log(chalk.yellow("\n(远程警告): " + result.stderr));
    }
    spinner.succeed(`版本 [${targetZipName}] 部署完成！`);
  } catch (error) {
    spinner.fail("远程解压失败！");
    throw error;
  }
}

/**
 * 获取远程备份
 */
async function getRemoteBackups() {
  const { webDir } = config.server;
  const backupDir = path.posix.join(webDir, BACKUP_DIR_NAME);
  const result = await ssh.execCommand(`ls -1t ${backupDir} | grep .zip`);
  if (result.stderr) return [];
  return result.stdout
    .split("\n")
    .filter(Boolean)
    .map((f) => f.trim());
}

function cleanupLocal(localPath) {
  if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
}

// ================= 业务流程 =================

async function runDeploy() {
  const timestamp = getTimeString();
  const zipName = `dist_${timestamp}.zip`;
  const localZipPath = path.resolve(currentDir, zipName);
  const { webDir } = config.server;
  const remoteZipPath = path.posix.join(webDir, BACKUP_DIR_NAME, zipName);

  try {
    await buildProject();
    await zipProject(zipName);
    await connectServer();
    await uploadFile(localZipPath, remoteZipPath);
    await deployRemote(zipName);
    console.log(
      chalk.bgGreen.bold(" SUCCESS ") + chalk.green(" 新版本发布成功！")
    );
  } catch (e) {
    console.error(chalk.red(e));
  } finally {
    cleanupLocal(localZipPath);
    ssh.dispose();
  }
}

async function runRollback() {
  try {
    await connectServer();
    const spinner = ora("正在获取远程版本列表...").start();
    const files = await getRemoteBackups();
    spinner.stop();

    if (files.length === 0) {
      console.log(chalk.red("服务器上没有可用的备份文件！"));
      return;
    }

    // prompts 的写法与 inquirer 略有不同 (title用于显示，value用于值)
    const { version } = await prompts({
      type: "select",
      name: "version",
      message: "请选择要回滚的版本:",
      choices: files.map((f) => ({ title: f, value: f })),
      initial: 0,
    });

    if (!version) return console.log(chalk.gray("已取消操作"));

    const { ok } = await prompts({
      type: "confirm",
      name: "ok",
      message: `确定回滚到 [${version}] ?`,
      initial: false,
    });

    if (ok) {
      await deployRemote(version);
      console.log(
        chalk.bgGreen.bold(" SUCCESS ") + chalk.green(" 版本回滚成功！")
      );
    } else {
      console.log(chalk.gray("已取消操作"));
    }
  } catch (e) {
    console.error(chalk.red(e));
  } finally {
    ssh.dispose();
  }
}

// ================= 主入口 =================

(async () => {
  console.log(chalk.bgBlue.bold(" DEPLOY CLI "));

  // 1. 拦截 Ctrl+C 等异常退出
  const onCancel = () => {
    console.log(chalk.gray("\n操作已取消"));
    process.exit(0);
  };

  // 2. 显示主菜单
  const { action } = await prompts(
    {
      type: "select",
      name: "action",
      message: "请选择操作:",
      choices: [
        { title: "🚀 发布新版本 (Build & Deploy)", value: "deploy" },
        { title: "🔙 版本回滚 (Rollback)", value: "rollback" },
        { title: "❌ 退出", value: "exit" },
      ],
      initial: 0,
    },
    { onCancel }
  );

  if (action === "deploy") await runDeploy();
  else if (action === "rollback") await runRollback();
  else process.exit(0);
})();
