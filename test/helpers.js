import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function createTempProject(prefix = "pcm-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function writeFile(root, relativePath, content) {
  const targetPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
  return targetPath;
}

export function cleanupTempProject(root) {
  if (root) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
