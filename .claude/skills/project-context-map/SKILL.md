---
name: project-context-map
description: Use this skill when working in a large repository and you want Claude Code to avoid reading too many files. First consult the project context map or MCP tools, identify the most relevant files for the task, and only then inspect or edit code.
---

# Project Context Map

Use this skill when a task involves code changes, debugging, or feature work in a medium or large repository.

## Goal

Reduce token usage and speed up edits by using the project context map before opening source files.

## Workflow

1. Start with the MCP if it is available.
2. Call `get_project_summary` to understand the architecture and hotspots.
3. Call `get_module_context` when the task already points to a feature area.
4. Call `find_relevant_files` with the user request.
5. Read only the top-ranked files first.
6. Expand to neighboring files only if the first pass is insufficient.
7. After edits, call `refresh_project_map` so `.project-map.json` and `.project-map.md` stay current.

## Fallback

If the MCP server is not available:

1. Look for `.project-map.json` and `.project-map.md` in the project root.
2. Use those files to identify relevant modules and files.
3. Only after that, inspect code files directly.

## Rules

- Do not begin by scanning the whole repository.
- Prefer targeted reads over broad tree walks.
- Use recent git changes as a signal when ranking files.
- Treat the project map as the primary onboarding artifact for the repo.

## Example prompts

- "Use the project context map to find the files for fixing login refresh bugs."
- "Check the project map first, then suggest where export CSV should be implemented."
- "Refresh the project map after this feature is completed."
