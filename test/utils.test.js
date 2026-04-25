import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "@jest/globals";
import {
  firstNonEmptyLine,
  isPathInsideProject,
  relativeProjectPath,
  tokenize,
  walkProjectFiles,
  writeJson
} from "../src/utils.js";
import { cleanupTempProject, createTempProject, writeFile } from "./helpers.js";

const tempProjects = [];

afterEach(() => {
  for (const root of tempProjects.splice(0)) {
    cleanupTempProject(root);
  }
});

describe("utils", () => {
  test("walkProjectFiles skips ignored directories and returns sorted paths", () => {
    const root = createTempProject();
    tempProjects.push(root);

    writeFile(root, "src/zeta.js", "export const zeta = true;\n");
    writeFile(root, "src/alpha.js", "export const alpha = true;\n");
    writeFile(root, "node_modules/pkg/index.js", "ignored\n");
    writeFile(root, "coverage/report.txt", "ignored\n");

    const files = walkProjectFiles(root).map((file) => relativeProjectPath(root, file));

    expect(files).toEqual(["src/alpha.js", "src/zeta.js"]);
  });

  test("firstNonEmptyLine returns the first trimmed text line for text files", () => {
    const root = createTempProject();
    tempProjects.push(root);
    const filePath = writeFile(root, "src/example.js", "\n\n   const value = 1;\nconsole.log(value);\n");

    expect(firstNonEmptyLine(filePath)).toBe("const value = 1;");
  });

  test("firstNonEmptyLine returns an empty string for non-text files", () => {
    const root = createTempProject();
    tempProjects.push(root);
    const filePath = writeFile(root, "assets/logo.png", "binary");

    expect(firstNonEmptyLine(filePath)).toBe("");
  });

  test("writeJson persists prettified JSON with a trailing newline", () => {
    const root = createTempProject();
    tempProjects.push(root);
    const filePath = path.join(root, "data.json");

    writeJson(filePath, { answer: 42 });

    expect(fs.readFileSync(filePath, "utf8")).toBe('{\n  "answer": 42\n}\n');
  });

  test("isPathInsideProject distinguishes inside and outside paths", () => {
    const root = createTempProject();
    tempProjects.push(root);
    const insidePath = path.join(root, "src/index.js");
    const outsidePath = path.resolve(root, "..", "elsewhere.js");

    expect(isPathInsideProject(root, insidePath)).toBe(true);
    expect(isPathInsideProject(root, outsidePath)).toBe(false);
  });

  test("tokenize lowercases text, splits on punctuation, and removes short tokens", () => {
    expect(tokenize("Fix API auth in src/index.js, now!")).toEqual(["fix", "api", "auth", "src", "index", "now"]);
  });
});
