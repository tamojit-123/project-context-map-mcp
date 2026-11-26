# Contributing to Project Context Map MCP

Thank you for your interest in contributing!

## Prerequisites

- Node.js `20` or newer
- npm

## Setup

```bash
git clone https://github.com/tamojit-123/project-context-map-mcp.git
cd project-context-map-mcp
npm ci
```

## Running Checks & Tests

Run syntax checks and the Jest test suite before opening a pull request:

```bash
npm run check
```

You can also run them individually:

```bash
npm run lint
npm test
```

## Pull Request Guidelines

1. Create a feature or fix branch from `main`.
2. Keep changes focused and include tests for new behavior or bug fixes.
3. Ensure `npm run check` passes locally.
4. Open a pull request describing the problem, solution, and verification steps.
