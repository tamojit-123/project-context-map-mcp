import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "@jest/globals";
import {
  appendChangeLog,
  buildProjectMap,
  explainFile,
  getModuleContext,
  readFilesSparse,
  refreshProjectMap,
  writeAndLog
} from "../src/indexer.js";
import { cleanupTempProject, createTempProject, writeFile } from "./helpers.js";

const tempProjects = [];

afterEach(() => {
  for (const root of tempProjects.splice(0)) {
    cleanupTempProject(root);
  }
});

function createSampleProject() {
  const root = createTempProject();
  tempProjects.push(root);

  writeFile(
    root,
    "package.json",
    `${JSON.stringify({ name: "sample-project", dependencies: { jest: "^30.3.0" }, devDependencies: { eslint: "^9.0.0" } }, null, 2)}\n`
  );
  writeFile(root, "src/index.js", 'import { helper } from "./helper.js";\nimport config from "../config/app.json";\nhelper(config);\n');
  writeFile(root, "src/helper.js", "export function helper(value) {\n  return value;\n}\n");
  writeFile(root, "config/app.json", '{\n  "name": "demo"\n}\n');
  writeFile(root, "README.md", "# Sample Project\n");

  return root;
}

describe("indexer", () => {
  test("buildProjectMap captures tech stack, dependencies, and internal topology", () => {
    const root = createSampleProject();

    const projectMap = buildProjectMap(root);

    expect(projectMap.project_summary.name).toBe(path.basename(root));
    expect(projectMap.project_summary.type).toBe("frontend");
    expect(projectMap.tech_stack).toContain("nodejs");
    expect(projectMap.stats.totalFiles).toBe(5);
    expect(projectMap.dependencies).toEqual(
      expect.arrayContaining([
        { ecosystem: "npm", name: "eslint" },
        { ecosystem: "npm", name: "jest" }
      ])
    );
    expect(projectMap.entrypoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "package.json" }),
        expect.objectContaining({ path: "src/index.js" })
      ])
    );
    expect(projectMap.topology.edges).toEqual(
      expect.arrayContaining([
        {
          from: "src/index.js",
          to: "config/app.json",
          type: "import"
        },
        {
          from: "src/index.js",
          to: "src/helper.js",
          type: "import"
        }
      ])
    );
    expect(projectMap.topology.externalDependencies).toEqual([]);
  });

  test("refreshProjectMap writes all generated project map artifacts", () => {
    const root = createSampleProject();

    const result = refreshProjectMap(root);

    expect(fs.existsSync(result.jsonPath)).toBe(true);
    expect(fs.existsSync(result.markdownPath)).toBe(true);
    expect(fs.existsSync(result.projectMarkdownPath)).toBe(true);
    expect(fs.readFileSync(result.markdownPath, "utf8")).toContain("# Project Context Map");
    expect(fs.readFileSync(result.projectMarkdownPath, "utf8")).toContain("## Change Log");
  });

  test("readFilesSparse returns indexed content and rejects unindexed or outside files", () => {
    const root = createSampleProject();
    refreshProjectMap(root);

    const result = readFilesSparse(root, ["src/index.js", "missing.js", "../outside.js"]);

    expect(result.files).toEqual([
      expect.objectContaining({
        path: "src/index.js",
        content: expect.stringContaining('import { helper } from "./helper.js";')
      }),
      {
        path: "missing.js",
        error: "Path is not indexed in the project topology."
      },
      {
        path: "../outside.js",
        error: "Path is outside the project root."
      }
    ]);
  });

  test("getModuleContext and explainFile return focused context from the generated map", () => {
    const root = createSampleProject();
    refreshProjectMap(root);

    const moduleContext = getModuleContext(root, "src");
    const explained = explainFile(root, "src/helper.js");

    expect(moduleContext).toMatchObject({
      module: expect.objectContaining({ name: "src" })
    });
    expect(moduleContext.files.map((file) => file.path)).toEqual(expect.arrayContaining(["src/index.js", "src/helper.js"]));
    expect(moduleContext.likelyImpactArea).toEqual(expect.arrayContaining(["src/helper.js"]));
    expect(explained).toMatchObject({
      path: "src/helper.js",
      module: "src",
      recentCommits: []
    });
  });

  test("appendChangeLog and writeAndLog add entries while keeping writes inside the project", () => {
    const root = createSampleProject();
    refreshProjectMap(root);

    const appendResult = appendChangeLog(root, "manual update");
    const writeResult = writeAndLog(root, "notes/todo.md", "Remember the map", "add todo");
    const projectContext = fs.readFileSync(path.join(root, ".project.md"), "utf8");

    expect(appendResult.entry).toContain("manual update");
    expect(writeResult).toMatchObject({
      path: "notes/todo.md",
      bytesWritten: Buffer.byteLength("Remember the map", "utf8")
    });
    expect(fs.readFileSync(path.join(root, "notes/todo.md"), "utf8")).toBe("Remember the map\n");
    expect(projectContext).toContain("manual update");
    expect(projectContext).toContain("notes/todo.md - add todo");
  });

  test("writeAndLog refuses writes outside the project root", () => {
    const root = createSampleProject();

    expect(() => writeAndLog(root, "../escape.txt", "nope")).toThrow("Refusing to write outside the project root.");
  });
});
