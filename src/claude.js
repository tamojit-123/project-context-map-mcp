import fs from "node:fs";
import path from "node:path";

export const SKILL_MARKDOWN = `---
name: project-context-map
description: Use this skill when working in a large repository and you want Claude Code to avoid reading too many files. First consult the project context map or MCP tools, identify the most relevant files for the task, and only then inspect or edit code.
---

# Project Context Map

Use this skill when a task involves code changes, debugging, or feature work in a medium or large repository.

## Goal

Reduce token usage and speed up edits by using the project context map before opening source files.

## Workflow

1. Start with the MCP if it is available.
2. Call \`read_project_context\` to understand the current repo memory in \`.project.md\`.
3. Call \`query_topology\` with the user request.
4. Call \`read_files_sparse\` with only the returned file paths.
5. Expand to neighboring files only if the first pass is insufficient.
6. Use \`write_and_log\` when you want MCP-managed writes with a \`.project.md\` Change Log entry.
7. After edits, call \`refresh_project_map\` so \`.project-map.json\`, \`.project-map.md\`, and \`.project.md\` stay current.

## Fallback

If the MCP server is not available:

1. Look for \`.project.md\`, \`.project-map.json\`, and \`.project-map.md\` in the project root.
2. Use those files to identify relevant modules and files.
3. Only after that, inspect code files directly.

## Rules

- Do not begin by scanning the whole repository.
- Prefer targeted reads over broad tree walks.
- Use recent git changes as a signal when ranking files.
- Treat the project map as the primary onboarding artifact for the repo.
`;

export function buildMcpConfig({
  projectRoot = ".",
  serverName = "project-context-map",
  command = "project-context-map-mcp"
} = {}) {
  return {
    mcpServers: {
      [serverName]: {
        command,
        args: ["serve", "--project-root", projectRoot],
        env: {}
      }
    }
  };
}

export function writeClaudeSkill(projectRoot) {
  const targetDir = path.join(projectRoot, ".claude", "skills", "project-context-map");
  const targetPath = path.join(targetDir, "SKILL.md");
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetPath, `${SKILL_MARKDOWN}\n`, "utf8");
  return targetPath;
}

export function writeMcpConfig(projectRoot, options = {}) {
  const targetPath = path.join(projectRoot, ".mcp.json");
  const generated = buildMcpConfig(options);
  let current = {};

  if (fs.existsSync(targetPath)) {
    current = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  }

  const config = {
    ...current,
    mcpServers: {
      ...(current.mcpServers || {}),
      ...generated.mcpServers
    }
  };

  fs.writeFileSync(targetPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return targetPath;
}
