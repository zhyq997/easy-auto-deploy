#!/usr/bin/env node

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import chalk from "chalk";

import { createArchive } from "./src/archive.mjs";
import { createTerminalUi, runCli } from "./src/cli.mjs";
import { loadConfig } from "./src/config.mjs";
import { createDeployService } from "./src/deploy-service.mjs";
import { createSshClient } from "./src/ssh-client.mjs";

export async function main({
  cwd = process.cwd(),
  logger = console,
  prompt,
} = {}) {
  let ui;

  try {
    const config = loadConfig({ cwd });
    ui = createTerminalUi({ logger });
    const archive = createArchive({
      projectDir: config.projectDir,
      localConfig: config.local,
      ...ui.archiveHooks,
    });
    const remote = createSshClient({
      serverConfig: config.server,
      ...ui.sshHooks,
    });
    const deployService = createDeployService({ archive, remote });

    return await runCli({
      deployService,
      logger,
      prompt,
      ui,
    });
  } catch (error) {
    ui?.stopActive();
    logger.error(chalk.red(error?.message ?? String(error)));
    return 1;
  }
}

export function isDirectExecution(
  moduleUrl,
  argvPath,
  realpath = fs.realpathSync
) {
  if (!argvPath) return false;

  try {
    return realpath(fileURLToPath(moduleUrl)) === realpath(argvPath);
  } catch {
    return false;
  }
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  process.exitCode = await main();
}
