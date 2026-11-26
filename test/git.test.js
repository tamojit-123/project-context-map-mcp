import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, test } from "@jest/globals";
import { getRecentGitChanges, isGitRepository } from "../src/git.js";
import { cleanupTempProject, createTempProject, writeFile } from "./helpers.js";

const tempProjects = [];

afterEach(() => {
  for (const root of tempProjects.splice(0)) {
    cleanupTempProject(root);
  }
});

describe("git helpers", () => {
  test("returns isGitRepo false for non-git directories", () => {
    const root = createTempProject();
    tempProjects.push(root);

    expect(isGitRepository(root)).toBe(false);
    expect(getRecentGitChanges(root, 5)).toEqual({
      isGitRepo: false,
      days: 5,
      commits: [],
      hotspots: []
    });
  });

  test("parses commits with __COMMIT__ in message and empty commits safely", () => {
    const root = createTempProject();
    tempProjects.push(root);

    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root, stdio: "ignore" });

    writeFile(root, "src/app.js", "export const a = 1;\n");
    execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "feat: handle __COMMIT__ marker"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["commit", "--allow-empty", "-m", "chore: empty commit"], { cwd: root, stdio: "ignore" });

    const changes = getRecentGitChanges(root, 5);

    expect(changes.isGitRepo).toBe(true);
    expect(changes.commits).toHaveLength(2);
    expect(changes.commits[0]).toMatchObject({
      summary: "chore: empty commit",
      files: []
    });
    expect(changes.commits[1]).toMatchObject({
      summary: "feat: handle __COMMIT__ marker",
      files: ["src/app.js"]
    });
    expect(changes.hotspots).toEqual([{ path: "src/app.js", count: 1 }]);
  });
});
