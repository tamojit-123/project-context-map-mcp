#!/usr/bin/env node

import { refreshProjectMap } from "../src/indexer.js";

export function refreshMapCli(projectRoot = process.env.PROJECT_ROOT || process.cwd()) {
  const result = refreshProjectMap(projectRoot);

  process.stdout.write(
    `${JSON.stringify(
      {
        message: "Project map refreshed.",
        jsonPath: result.jsonPath,
        markdownPath: result.markdownPath,
        projectMarkdownPath: result.projectMarkdownPath,
        totalFiles: result.projectMap.stats.totalFiles,
        generatedAt: result.projectMap.generatedAt
      },
      null,
      2
    )}\n`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  refreshMapCli(process.argv[2] || process.env.PROJECT_ROOT || process.cwd());
}
