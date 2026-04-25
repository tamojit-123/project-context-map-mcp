import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "@jest/globals";
import { buildMcpConfig, writeClaudeSkill, writeMcpConfig } from "../src/claude.js";
import { cleanupTempProject, createTempProject, writeFile } from "./helpers.js";

const tempProjects = [];

afterEach(() => {
  for (const root of tempProjects.splice(0)) {
    cleanupTempProject(root);
  }
});

describe("claude helpers", () => {
  test("buildMcpConfig uses provided server options", () => {
    expect(
      buildMcpConfig({
        projectRoot: "/repo",
        serverName: "custom-server",
        command: "node"
      })
    ).toEqual({
      mcpServers: {
        "custom-server": {
          command: "node",
          args: ["serve", "--project-root", "/repo"],
          env: {}
        }
      }
    });
  });

  test("writeClaudeSkill creates the skill markdown in the Claude directory", () => {
    const root = createTempProject();
    tempProjects.push(root);

    const skillPath = writeClaudeSkill(root);

    expect(skillPath).toBe(path.join(root, ".claude", "skills", "project-context-map", "SKILL.md"));
    expect(fs.readFileSync(skillPath, "utf8")).toContain("name: project-context-map");
  });

  test("writeMcpConfig merges with existing config instead of replacing it", () => {
    const root = createTempProject();
    tempProjects.push(root);
    writeFile(
      root,
      ".mcp.json",
      `${JSON.stringify({ mcpServers: { existing: { command: "old", args: ["serve"], env: { DEBUG: "1" } } } }, null, 2)}\n`
    );

    const configPath = writeMcpConfig(root, {
      projectRoot: ".",
      serverName: "project-context-map",
      command: "project-context-map-mcp"
    });

    const saved = JSON.parse(fs.readFileSync(configPath, "utf8"));
    expect(saved.mcpServers.existing).toEqual({
      command: "old",
      args: ["serve"],
      env: { DEBUG: "1" }
    });
    expect(saved.mcpServers["project-context-map"]).toEqual({
      command: "project-context-map-mcp",
      args: ["serve", "--project-root", "."],
      env: {}
    });
  });
});
