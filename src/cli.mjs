import chalk from "chalk";
import cliProgress from "cli-progress";
import ora from "ora";
import prompts from "prompts";

export function createTerminalUi({ logger = console } = {}) {
  let spinner;
  let progressBar;

  return {
    archiveHooks: {
      onBuildStart(command) {
        logger.log(
          chalk.blue("---------------------------------------------------")
        );
        logger.log(chalk.blue(`正在执行本地打包: ${command}`));
        logger.log(
          chalk.blue("---------------------------------------------------")
        );
      },
      onBuildComplete() {
        logger.log(chalk.green("\nBuild 完成！"));
      },
      onZipStart() {
        spinner = ora("正在压缩文件...").start();
      },
      onZipComplete({ zipName, bytes }) {
        spinner?.succeed(
          `压缩完成: ${zipName} (${(bytes / 1024 / 1024).toFixed(2)} MB)`
        );
        spinner = undefined;
      },
    },

    sshHooks: {
      onConnectStart() {
        spinner = ora("正在连接服务器...").start();
      },
      onConnectComplete() {
        spinner?.succeed("服务器连接成功！");
        spinner = undefined;
      },
      onUploadStart({ total }) {
        logger.log(chalk.cyan("开始上传文件..."));
        progressBar = new cliProgress.SingleBar({
          format:
            "上传进度 |" +
            chalk.cyan("{bar}") +
            "| {percentage}% || {value}/{total} Bytes",
          barCompleteChar: "\u2588",
          barIncompleteChar: "\u2591",
          hideCursor: true,
        });
        progressBar.start(total, 0);
      },
      onUploadProgress({ transferred }) {
        progressBar?.update(transferred);
      },
      onUploadComplete() {
        progressBar?.stop();
        progressBar = undefined;
        logger.log(chalk.green("\n文件上传成功！"));
      },
      onDeployStart() {
        spinner = ora("正在清理旧文件并解压目标版本...").start();
      },
      onDeployComplete(version) {
        spinner?.succeed(`版本 [${version}] 部署完成！`);
        spinner = undefined;
      },
      onRemoteWarning(message) {
        logger.log(chalk.yellow("\n(远程警告): " + message));
      },
    },

    stopActive() {
      progressBar?.stop();
      progressBar = undefined;
      spinner?.stop();
      spinner = undefined;
    },
  };
}

export async function runCli({
  deployService,
  prompt = prompts,
  logger = console,
  ui,
}) {
  try {
    logger.log(chalk.bgBlue.bold(" DEPLOY CLI "));
    const { action } = await prompt(
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
      {
        onCancel() {
          logger.log(chalk.gray("\n操作已取消"));
          return false;
        },
      }
    );

    if (action === "deploy") {
      await deployService.deploy();
      logger.log(
        chalk.bgGreen.bold(" SUCCESS ") +
          chalk.green(" 新版本发布成功！")
      );
      return 0;
    }

    if (action === "rollback") {
      const files = await deployService.listBackups();
      if (files.length === 0) {
        logger.log(chalk.red("服务器上没有可用的备份文件！"));
        return 0;
      }

      const { version } = await prompt({
        type: "select",
        name: "version",
        message: "请选择要回滚的版本:",
        choices: files.map((file) => ({ title: file, value: file })),
        initial: 0,
      });
      if (!version) {
        logger.log(chalk.gray("已取消操作"));
        return 0;
      }

      const { ok } = await prompt({
        type: "confirm",
        name: "ok",
        message: `确定回滚到 [${version}] ?`,
        initial: false,
      });
      if (!ok) {
        logger.log(chalk.gray("已取消操作"));
        return 0;
      }

      await deployService.rollback(version);
      logger.log(
        chalk.bgGreen.bold(" SUCCESS ") +
          chalk.green(" 版本回滚成功！")
      );
    }

    return 0;
  } catch (error) {
    ui?.stopActive();
    logger.error(chalk.red(error?.message ?? String(error)));
    return 1;
  }
}
