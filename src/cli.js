#!/usr/bin/env node

import { installGitHooks } from "../scripts/install-git-hooks.js";
import { refreshMapCli } from "../scripts/refresh-map.js";
import { buildMcpConfig, writeClaudeSkill, writeMcpConfig } from "./claude.js";
import { startServer } from "./server.js";

function parseArgs(argv) {
  const [command = "serve", ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const next = rest[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return { command, options };
}

function printHelp() {
  process.stdout.write(`project-context-map-mcp

Commands:
  serve [--project-root <path>]
  refresh [--project-root <path>]
  install-hooks [--project-root <path>]
  configure-claude [--project-root <path>] [--server-name <name>] [--command <cmd>]
  print-mcp-config [--project-root <path>] [--server-name <name>] [--command <cmd>]
  help
`);
}

const { command, options } = parseArgs(process.argv.slice(2));
const projectRoot = options["project-root"] || process.cwd();

if (command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (command === "serve") {
  if (options["project-root"]) {
    process.env.PROJECT_ROOT = projectRoot;
  }
  await startServer();
  process.exit(0);
}

if (command === "refresh") {
  refreshMapCli(projectRoot);
  process.exit(0);
}

if (command === "install-hooks") {
  installGitHooks(projectRoot);
  process.exit(0);
}

if (command === "configure-claude") {
  const skillPath = writeClaudeSkill(projectRoot);
  const configPath = writeMcpConfig(projectRoot, {
    projectRoot: ".",
    serverName: options["server-name"] || "project-context-map",
    command: options.command || "project-context-map-mcp"
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        message: "Claude Code skill and .mcp.json created.",
        skillPath,
        configPath
      },
      null,
      2
    )}\n`
  );
  process.exit(0);
}

if (command === "print-mcp-config") {
  process.stdout.write(
    `${JSON.stringify(
      buildMcpConfig({
        projectRoot: options["project-root"] || ".",
        serverName: options["server-name"] || "project-context-map",
        command: options.command || "project-context-map-mcp"
      }),
      null,
      2
    )}\n`
  );
  process.exit(0);
}

printHelp();
process.exit(1);
