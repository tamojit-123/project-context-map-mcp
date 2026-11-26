import { afterEach, describe, expect, test } from "@jest/globals";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { cleanupTempProject, createTempProject, writeFile } from "./helpers.js";

const cleanups = [];

afterEach(async () => {
  for (const fn of cleanups.splice(0)) {
    await fn();
  }
});

async function createConnectedClient() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  const client = new Client({ name: "test-client", version: "0.1.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  cleanups.push(async () => {
    await client.close();
    await server.close();
  });

  return client;
}

describe("MCP server validation and error handling", () => {
  test("rejects invalid limit, days, and paths arguments with structured isError responses", async () => {
    const root = createTempProject();
    cleanups.push(() => cleanupTempProject(root));
    writeFile(root, "src/index.js", "export const x = 1;\n");

    const client = await createConnectedClient();

    const badLimit = await client.callTool({
      name: "find_relevant_files",
      arguments: { projectRoot: root, task: "index", limit: "abc" }
    });
    expect(badLimit.isError).toBe(true);
    expect(JSON.parse(badLimit.content[0].text).error).toContain('Invalid "limit"');

    const badDays = await client.callTool({
      name: "get_recent_git_changes",
      arguments: { projectRoot: root, days: -2 }
    });
    expect(badDays.isError).toBe(true);
    expect(JSON.parse(badDays.content[0].text).error).toContain('Invalid "days"');

    const badPaths = await client.callTool({
      name: "read_files_sparse",
      arguments: { projectRoot: root, paths: "src/index.js" }
    });
    expect(badPaths.isError).toBe(true);
    expect(JSON.parse(badPaths.content[0].text).error).toContain('Invalid "paths"');
  });

  test("returns structured isError when write_and_log attempts to escape project root", async () => {
    const root = createTempProject();
    cleanups.push(() => cleanupTempProject(root));

    const client = await createConnectedClient();
    const res = await client.callTool({
      name: "write_and_log",
      arguments: { projectRoot: root, path: "../escape.txt", content: "nope" }
    });

    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0].text).error).toContain("Refusing to write outside the project root.");
  });

  test("returns structured isError for unknown tool names", async () => {
    const client = await createConnectedClient();
    const res = await client.callTool({
      name: "nonexistent_tool",
      arguments: {}
    });

    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0].text).error).toContain("Unknown tool: nonexistent_tool");
  });
});
