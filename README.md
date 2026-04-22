# Project Context Map MCP

> Give Claude Code and other MCP clients a project memory, so they stop rereading the whole repository for every task.

Project Context Map MCP is a Node.js MCP server plus a Claude Code skill that helps AI coding agents understand a repository through a generated project map instead of blindly scanning every file.

It is designed for large codebases where token usage, slow context building, and noisy file exploration become a real problem.

## Why this exists

When you ask an AI coding agent to fix a bug or add a feature in a big repo, it often starts by reading too much of the project.

That creates a few common problems:

- high token or credit usage
- slow reasoning before any real work starts
- poor focus on the actual files that matter
- repeated scanning of unchanged or unrelated areas

Project Context Map MCP solves that by generating a lightweight project memory:

- `.project-map.json` for machines
- `.project-map.md` for humans and AI
- `.project.md` as the main readable context document with a running Change Log

The MCP server then uses that memory to answer questions like:

- What is this project?
- Which modules matter for this task?
- Which files should be opened first?
- What changed recently?
- Which areas should probably be ignored?

## What you get

- A JavaScript MCP server built with `@modelcontextprotocol/sdk`
- A global CLI: `project-context-map-mcp`
- A generated project map:
  - `.project-map.json`
  - `.project-map.md`
  - `.project.md`
- Git-aware summaries for the last 5 days
- Ranked file suggestions for natural-language tasks
- Import and file-usage topology extracted from project source files
- Module-level context lookup
- Sparse file reads gated by the indexed topology
- Logged writes that append to `.project.md`
- Claude Code skill generation
- Project `.mcp.json` generation
- Optional git hooks to keep the project map fresh

## How it works

The intended workflow is:

1. Generate the project map
2. Read `.project.md` or call `read_project_context`
3. Use `query_topology` to find relevant files and import/dependency neighbors
4. Use `read_files_sparse` to read only the indexed files you actually need
5. Use `write_and_log` or normal edits, then refresh the project map

This follows the core rule:

**Index first, files second, full code last.**

## Installation

### Global install

Recommended if you want to use this across multiple repositories.

```bash
npm install -g project-context-map-mcp
```

### Local install

If you only want to use it inside one repository:

```bash
npm install
```

## Quick Start

### 1. Generate the project map

From your project root:

```bash
project-context-map-mcp refresh --project-root .
```

This creates:

- `.project-map.json`
- `.project-map.md`
- `.project.md`

### 2. Configure Claude Code for the repo

```bash
project-context-map-mcp configure-claude --project-root .
```

This creates or updates:

- `.mcp.json`
- `.claude/skills/project-context-map/SKILL.md`

### 3. Open the repo in Claude Code

Inside Claude Code:

1. Open the project
2. Approve the MCP server from `.mcp.json`
3. Restart Claude Code if the skill does not appear immediately

### 4. Start using it

Example prompts:

- `Use the project context map to find the files for fixing login refresh bugs.`
- `Check the project map first, then tell me where export CSV should be implemented.`
- `Refresh the project map after this feature is finished.`

## CLI Commands

### Start the MCP server

```bash
project-context-map-mcp serve --project-root .
```

### Refresh the project map

```bash
project-context-map-mcp refresh --project-root .
```

### Install git hooks

```bash
project-context-map-mcp install-hooks --project-root .
```

This installs:

- `post-commit`
- `post-merge`
- `post-push`

Each hook refreshes the project map automatically.

### Configure Claude Code for a repo

```bash
project-context-map-mcp configure-claude --project-root .
```

### Print MCP config without writing files

```bash
project-context-map-mcp print-mcp-config --project-root .
```

### Show help

```bash
project-context-map-mcp help
```

## Claude Code Setup

After running:

```bash
project-context-map-mcp configure-claude --project-root .
```

your repo will contain a `.mcp.json` like this:

```json
{
  "mcpServers": {
    "project-context-map": {
      "command": "project-context-map-mcp",
      "args": ["serve", "--project-root", "."],
      "env": {}
    }
  }
}
```

It will also create a Claude Code skill at:

```text
.claude/skills/project-context-map/SKILL.md
```

That skill tells Claude Code to:

- consult the project map first
- prefer MCP tools over broad repo scans
- narrow down to relevant files before reading source code

## MCP Tools

The server exposes these tools:

### `read_project_context`

Returns:

- `.project.md` content
- project summary
- topology highlights
- accumulated Change Log entries

### `query_topology`

Input:

- a natural-language query

Returns:

- matched file paths from the query index
- confidence score
- ranked matches with reasons
- per-file topology context:
  `dependencies`
  `usedBy`

### `read_files_sparse`

Input:

- repository-relative file paths

Returns:

- file contents for indexed paths only
- errors for paths outside the repo or missing from topology

### `write_and_log`

Input:

- repository-relative path
- full file content
- optional short summary

Returns:

- write result
- bytes written
- appended `.project.md` Change Log entry

### `get_project_summary`

Returns:

- project summary
- tech stack
- entrypoints
- important modules
- hotspots

### `get_module_context`

Returns:

- module summary
- related files
- recent commits
- likely impact area

### `find_relevant_files`

Input:

- a natural-language task

Returns:

- ranked file list
- confidence score
- reasons for each match
- modules that can likely be avoided

### `refresh_project_map`

Regenerates:

- `.project-map.json`
- `.project-map.md`
- `.project.md`

### `get_recent_git_changes`

Returns:

- recent commits from the last 5 days
- hotspot files

### `explain_file_role`

Returns:

- what a file does
- which module it belongs to
- recent related commits

## Generated Files

### `.project-map.json`

Machine-readable source of truth.

Current shape includes:

- `project_summary`
- `tech_stack`
- `modules`
- `files`
- `topology`
- `entrypoints`
- `dependencies`
- `recent_changes`
- `hotspots`
- `ownership`

### `.project-map.md`

Human-readable summary generated from the JSON.

Useful for:

- onboarding
- quick repo understanding
- AI agent context

### `.project.md`

Human-readable working memory for agents and humans.

Useful for:

- loading project context quickly
- seeing file-topology highlights
- maintaining a running Change Log of edits

## Example Workflow

Say the user asks:

```text
Fix the login bug where session expires after refresh
```

Instead of reading the whole codebase first, the agent should:

1. call `read_project_context`
2. call `query_topology`
3. call `read_files_sparse` for the matched auth/session files
4. expand only if needed
5. update code with `write_and_log` or normal file edits
6. call `refresh_project_map`

## Best Use Cases

This project is especially useful for:

- large React applications
- Next.js monorepos
- Spring Boot backends
- Python services
- mixed frontend/backend repositories
- repos where AI agents are used frequently for maintenance or feature work

## Current Scope

What the current version already does well:

- generates project map artifacts
- ranks candidate files for a task
- uses recent git history as a signal
- extracts internal import/file dependency edges for indexed topology
- exposes the topology through MCP-friendly sparse read and write tools
- works as an MCP server
- works as a Claude Code skill companion
- supports global npm installation

What is still intentionally lightweight:

- framework analysis is heuristic, not full AST graph analysis yet
- module dependencies are inferred, not deeply resolved yet
- manual override support is reserved but not fully expanded yet
- PR and CI integrations are not implemented yet

## Development

Run the local checks:

```bash
npm run check
```

Run locally without global install:

```bash
npm run refresh-map
npm run mcp
```

## Project Structure

```text
src/
  cli.js
  server.js
  indexer.js
  ranker.js
  git.js
  claude.js
  utils.js

scripts/
  refresh-map.js
  install-git-hooks.js

.claude/skills/project-context-map/
  SKILL.md
```

## Vision

This project is not just a markdown generator.

It is a project memory system for coding agents.

The long-term goal is to help tools like Claude Code, Copilot, and other MCP clients make targeted, context-aware changes with far less wasted context and far better focus.

## License

MIT
