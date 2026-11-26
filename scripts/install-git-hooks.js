#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isGitRepository } from "../src/git.js";

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

export function buildHook(name, projectRoot) {
  const resolvedRoot = path.resolve(projectRoot);
  return `#!/bin/sh
project-context-map-mcp refresh --project-root ${shellQuote(resolvedRoot)} >/dev/null 2>&1 || true
`;
}

function resolveHooksDir(projectRoot) {
  const resolvedRoot = path.resolve(projectRoot);
  const gitHooksPath = execFileSync("git", ["-C", resolvedRoot, "rev-parse", "--git-path", "hooks"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();

  return path.resolve(resolvedRoot, gitHooksPath);
}

export function installGitHooks(projectRoot = process.cwd()) {
  const resolvedRoot = path.resolve(projectRoot);

  if (!isGitRepository(resolvedRoot)) {
    process.stderr.write("No git repository detected. Skipping hook installation.\n");
    return;
  }

  const targetDir = resolveHooksDir(resolvedRoot);
  fs.mkdirSync(targetDir, { recursive: true });

  for (const name of ["post-commit", "post-merge", "post-push"]) {
    const target = path.join(targetDir, name);
    fs.writeFileSync(target, buildHook(name, resolvedRoot), "utf8");
    fs.chmodSync(target, 0o755);
  }

  process.stdout.write("Installed git hooks: post-commit, post-merge, post-push\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  installGitHooks(process.argv[2] || process.cwd());
}
