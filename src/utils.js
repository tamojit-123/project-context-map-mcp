import fs from "node:fs";
import path from "node:path";

export const MAP_JSON_FILE = ".project-map.json";
export const MAP_MD_FILE = ".project-map.md";
export const PROJECT_MD_FILE = ".project.md";

const IGNORED_DIRS = new Set([
  ".git",
  ".idea",
  ".next",
  ".turbo",
  ".vscode",
  "coverage",
  "dist",
  "build",
  "node_modules",
  "target",
  "__pycache__",
  ".venv",
  "venv"
]);

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".conf",
  ".css",
  ".env",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".md",
  ".mjs",
  ".properties",
  ".py",
  ".rb",
  ".sql",
  ".sh",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml"
]);

export function resolveProjectRoot(projectRoot) {
  return path.resolve(projectRoot || process.env.PROJECT_ROOT || process.cwd());
}

export function pathExists(targetPath) {
  return fs.existsSync(targetPath);
}

export function readJsonIfExists(filePath) {
  if (!pathExists(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(filePath, value) {
  fs.writeFileSync(filePath, `${value}\n`, "utf8");
}

export function readTextIfExists(filePath) {
  if (!pathExists(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, "utf8");
}

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export function relativeProjectPath(projectRoot, targetPath) {
  return toPosixPath(path.relative(projectRoot, targetPath));
}

export function isPathInsideProject(projectRoot, targetPath) {
  const relativePath = path.relative(projectRoot, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

export function shouldIgnoreDirectory(dirname) {
  return IGNORED_DIRS.has(dirname);
}

export function isTextLikeFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function walkProjectFiles(projectRoot) {
  const files = [];
  const queue = [projectRoot];

  while (queue.length > 0) {
    const current = queue.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (!shouldIgnoreDirectory(entry.name)) {
          queue.push(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      files.push(absolutePath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

export function firstNonEmptyLine(filePath) {
  if (!isTextLikeFile(filePath)) {
    return "";
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const line = content
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .find(Boolean);

    return line || "";
  } catch {
    return "";
  }
}

export function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 2);
}
