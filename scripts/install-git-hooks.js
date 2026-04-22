#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { isGitRepository } from "../src/git.js";

function buildHook(name, projectRoot) {
  return `#!/bin/sh
project-context-map-mcp refresh --project-root "${projectRoot}" >/dev/null 2>&1 || true
`;
}

export function installGitHooks(projectRoot = process.cwd()) {
  if (!isGitRepository(projectRoot)) {
    process.stderr.write("No git repository detected. Skipping hook installation.\n");
    return;
  }

  const targetDir = path.join(projectRoot, ".git", "hooks");

  for (const name of ["post-commit", "post-merge", "post-push"]) {
    const target = path.join(targetDir, name);
    fs.writeFileSync(target, buildHook(name, projectRoot), "utf8");
    fs.chmodSync(target, 0o755);
  }

  process.stdout.write("Installed git hooks: post-commit, post-merge, post-push\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  installGitHooks(process.argv[2] || process.cwd());
}
