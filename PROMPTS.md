# Prompt Pack

This file contains tested starter prompts for `project-context-map-mcp`.

These prompts are written for MCP clients such as Claude Code, Cursor, and VS Code Copilot Chat after the server is already connected.

## Best General Starter

```text
Use the `project-context-map` MCP server first. Get the project summary, find the files most relevant to this task: [task], and read only those files before proposing or making changes.
```

## Repo Understanding

```text
Use the project context map to summarize this repository: main purpose, entrypoints, top modules, hotspots, and how the CLI, server, and indexer fit together.
```

```text
Use the `project-context-map` MCP server first. Get the project summary, then inspect `src/cli.js`, `src/server.js`, and the project map generation code to explain how startup and indexing work.
```

## Bug Investigation

```text
Use the MCP tools to investigate this bug: [bug description]. Start with the project summary, find the relevant files, read only those files, explain the likely root cause, and then propose or apply a fix.
```

```text
Use the project topology first for this issue: [bug description]. Prefer source files over docs, then inspect only the matched files.
```

## Feature Work

```text
I want to add [feature]. Use the project map to identify the impacted modules, relevant files, and likely downstream effects before editing anything.
```

```text
Use the `project-context-map` MCP server to find the code paths involved in [feature]. Read only the matched files and make the smallest safe change.
```

## Targeted Code Search

```text
Use `query_topology` to find all files related to npm publishing, package configuration, and release safety checks. Then read only the matched source and config files.
```

```text
Use the MCP tools to find where [system or feature area] is implemented. Show the matched files and why they matter before editing code.
```

## Module Understanding

```text
Use `get_module_context` for `src` and explain how the CLI, MCP server, ranking, and project map generation fit together.
```

```text
Explain the role of `src/cli.js` and how it interacts with `src/server.js`, using the project map and recent changes.
```

## Change Risk

```text
Use the project map and recent git changes to tell me which files are riskiest to modify for [task].
```

```text
Check recent git changes and project hotspots, then identify the safest place to implement [task].
```

## Prompt Writing Tips

- Broad prompts often rank docs first, especially for words like `project`, `map`, or `MCP`.
- More precise prompts work better when they mention specific files, modules, or feature areas.
- A strong workflow is: `get_project_summary` -> `find_relevant_files` or `query_topology` -> `read_files_sparse`.
- For debugging and implementation, prefer prompts that say `prefer source files over docs`.

## Client-Specific Versions

### Claude Code

```text
Use the `project-context-map` MCP server first. Start with `get_project_summary`, then find the files most relevant to [task], and read only the necessary files before making changes.
```

### Cursor

```text
Use the connected MCP server `project-context-map` for repo understanding. First get a project summary, then query the most relevant files for: [task]. Read only those files, explain your plan briefly, and then implement the change.
```

### VS Code Copilot Chat

```text
Use the `project-context-map` MCP server to summarize this repo and identify the files relevant to [task].
```
