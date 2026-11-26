import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "@jest/globals";
import { buildHook, installGitHooks } from "../scripts/install-git-hooks.js";
import { cleanupTempProject, createTempProject } from "./helpers.js";

const tempProjects = [];

afterEach(() => {
  for (const root of tempProjects.splice(0)) {
    cleanupTempProject(root);
  }
});

describe("install-git-hooks", () => {
  test("buildHook single-quote escapes special shell characters in projectRoot", () => {
    const trickyRoot = "/tmp/repo's $(touch /tmp/pwn) `id`";
    const script = buildHook("post-commit", trickyRoot);

    expect(script).toContain("--project-root '/tmp/repo'\\''s $(touch /tmp/pwn) `id`'");
    expect(script).not.toContain(`"${trickyRoot}"`);
  });

  test("installGitHooks creates hooks directory when missing and installs executable hooks", () => {
    const root = createTempProject();
    tempProjects.push(root);

    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    const hooksDir = path.join(root, ".git", "hooks");
    fs.rmSync(hooksDir, { recursive: true, force: true });

    installGitHooks(root);

    for (const name of ["post-commit", "post-merge", "post-push"]) {
      const hookPath = path.join(hooksDir, name);
      expect(fs.existsSync(hookPath)).toBe(true);
      const mode = fs.statSync(hookPath).mode;
      expect(mode & 0o111).toBeGreaterThan(0);
    }
  });
});
