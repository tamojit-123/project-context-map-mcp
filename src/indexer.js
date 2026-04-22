import fs from "node:fs";
import path from "node:path";
import { getLastChangedReasonMap, getRecentGitChanges } from "./git.js";
import {
  MAP_JSON_FILE,
  MAP_MD_FILE,
  PROJECT_MD_FILE,
  firstNonEmptyLine,
  isPathInsideProject,
  isTextLikeFile,
  pathExists,
  readTextIfExists,
  readJsonIfExists,
  relativeProjectPath,
  resolveProjectRoot,
  walkProjectFiles,
  writeJson,
  writeText
} from "./utils.js";

function detectTechStack(projectRoot) {
  const checks = [
    { file: "package.json", tag: "nodejs" },
    { file: "next.config.js", tag: "nextjs" },
    { file: "next.config.mjs", tag: "nextjs" },
    { file: "next.config.ts", tag: "nextjs" },
    { file: "pom.xml", tag: "springboot" },
    { file: "build.gradle", tag: "gradle" },
    { file: "build.gradle.kts", tag: "gradle" },
    { file: "requirements.txt", tag: "python" },
    { file: "pyproject.toml", tag: "python" },
    { file: "manage.py", tag: "django" },
    { file: "Cargo.toml", tag: "rust" }
  ];

  return checks
    .filter((item) => pathExists(path.join(projectRoot, item.file)))
    .map((item) => item.tag)
    .filter((value, index, array) => array.indexOf(value) === index);
}

function inferProjectType(techStack) {
  const hasFrontend = techStack.some((item) => ["nextjs", "react", "nodejs"].includes(item));
  const hasBackend = techStack.some((item) => ["springboot", "python", "django"].includes(item));

  if (hasFrontend && hasBackend) {
    return "fullstack";
  }

  if (hasBackend) {
    return "backend";
  }

  if (hasFrontend) {
    return "frontend";
  }

  return "application";
}

function inferRole(relativePath) {
  const value = relativePath.toLowerCase();
  const ext = path.extname(relativePath).toLowerCase();

  if (value.startsWith("scripts/hooks/")) {
    return "Git automation hook";
  }

  if (value.includes("/test") || value.includes(".test.") || value.includes(".spec.")) {
    return "Test coverage for a feature or module";
  }

  if (value.includes("controller")) {
    return "Request or route controller";
  }

  if (value.includes("service")) {
    return "Business logic service";
  }

  if (value.includes("repository")) {
    return "Data access or persistence layer";
  }

  if (value.includes("component") || ext === ".jsx" || ext === ".tsx") {
    return "UI component";
  }

  if (value.includes("hook")) {
    return "Reusable UI or state hook";
  }

  if (value.includes("api") || value.includes("client")) {
    return "API integration or boundary";
  }

  if (value.endsWith("package.json")) {
    return "Package metadata and scripts";
  }

  if (value.endsWith("pom.xml") || value.endsWith("build.gradle")) {
    return "Build and dependency configuration";
  }

  if (ext === ".md") {
    return "Project documentation";
  }

  if (ext === ".json" || ext === ".yaml" || ext === ".yml" || ext === ".properties") {
    return "Configuration file";
  }

  if (ext === ".java") {
    return "Java source file";
  }

  if (ext === ".py") {
    return "Python source file";
  }

  if (ext === ".js" || ext === ".mjs" || ext === ".cjs" || ext === ".ts") {
    return "Application or tooling source file";
  }

  return "Project file";
}

function inferModule(relativePath) {
  const segments = relativePath.split("/");
  const [first, second, third] = segments;

  if (segments.length === 1) {
    return "root";
  }

  if (segments.length === 2) {
    return first;
  }

  if (first === "src" || first === "app" || first === "backend" || first === "frontend") {
    return third ? second : first;
  }

  if (first === ".claude" && second === "skills") {
    return second;
  }

  return first;
}

function inferTags(relativePath) {
  const value = relativePath.toLowerCase();
  const tags = new Set();

  if (value.includes("auth")) tags.add("auth");
  if (value.includes("login")) tags.add("login");
  if (value.includes("user")) tags.add("user");
  if (value.includes("payment")) tags.add("payment");
  if (value.includes("api")) tags.add("api");
  if (value.includes("config")) tags.add("config");
  if (value.includes("test") || value.includes("spec")) tags.add("test");
  if (value.includes("component")) tags.add("ui");
  if (value.includes("hook")) tags.add("hook");
  if (value.endsWith(".tsx") || value.endsWith(".jsx")) tags.add("react");
  if (value.includes("/app/") || value.includes("next.config")) tags.add("nextjs");
  if (value.endsWith(".java") || value.includes("spring")) tags.add("java");
  if (value.endsWith(".py")) tags.add("python");

  return [...tags];
}

function buildFileRecord(projectRoot, absolutePath) {
  const relativePath = relativeProjectPath(projectRoot, absolutePath);
  const firstLine = firstNonEmptyLine(absolutePath);

  return {
    path: relativePath,
    module: inferModule(relativePath),
    role: inferRole(relativePath),
    tags: inferTags(relativePath),
    summary: firstLine.slice(0, 160)
  };
}

function tryResolveImport(fromFile, specifier) {
  const baseDir = path.dirname(fromFile);
  const candidates = [];

  if (specifier.startsWith("/")) {
    return null;
  }

  if (path.extname(specifier)) {
    candidates.push(path.resolve(baseDir, specifier));
  } else {
    candidates.push(
      path.resolve(baseDir, specifier),
      path.resolve(baseDir, `${specifier}.js`),
      path.resolve(baseDir, `${specifier}.mjs`),
      path.resolve(baseDir, `${specifier}.cjs`),
      path.resolve(baseDir, `${specifier}.ts`),
      path.resolve(baseDir, `${specifier}.tsx`),
      path.resolve(baseDir, `${specifier}.jsx`),
      path.resolve(baseDir, specifier, "index.js"),
      path.resolve(baseDir, specifier, "index.ts"),
      path.resolve(baseDir, specifier, "index.tsx"),
      path.resolve(baseDir, specifier, "__init__.py"),
      path.resolve(baseDir, `${specifier}.py`)
    );
  }

  return candidates.find((candidate) => pathExists(candidate)) || null;
}

function extractImportSpecifiers(relativePath, content) {
  const ext = path.extname(relativePath).toLowerCase();
  const specs = new Set();

  if ([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"].includes(ext)) {
    const importPatterns = [
      /import\s+[^"'`]*?from\s+["'`]([^"'`]+)["'`]/g,
      /import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
      /require\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
      /export\s+[^"'`]*?from\s+["'`]([^"'`]+)["'`]/g
    ];

    for (const pattern of importPatterns) {
      for (const match of content.matchAll(pattern)) {
        if (match[1]) {
          specs.add(match[1]);
        }
      }
    }
  }

  if (ext === ".py") {
    for (const match of content.matchAll(/(?:from\s+([a-zA-Z0-9_./]+)\s+import|import\s+([a-zA-Z0-9_.,\s]+))/g)) {
      const specifier = match[1] || match[2]?.split(",")[0]?.trim();
      if (specifier) {
        specs.add(specifier.replace(/\./g, "/"));
      }
    }
  }

  return [...specs];
}

function buildTopology(projectRoot, files) {
  const fileSet = new Set(files.map((file) => file.path));
  const adjacency = new Map(files.map((file) => [file.path, new Set()]));
  const reverse = new Map(files.map((file) => [file.path, new Set()]));
  const externalDependencies = new Map();

  for (const file of files) {
    const absolutePath = path.join(projectRoot, file.path);
    if (!isTextLikeFile(absolutePath)) {
      continue;
    }

    let content = "";
    try {
      content = fs.readFileSync(absolutePath, "utf8");
    } catch {
      continue;
    }

    const specifiers = extractImportSpecifiers(file.path, content);

    for (const specifier of specifiers) {
      if (specifier.startsWith(".") || specifier.startsWith("..")) {
        const resolved = tryResolveImport(absolutePath, specifier);
        if (!resolved) {
          continue;
        }

        const targetPath = relativeProjectPath(projectRoot, resolved);
        if (!fileSet.has(targetPath)) {
          continue;
        }

        adjacency.get(file.path).add(targetPath);
        reverse.get(targetPath).add(file.path);
        continue;
      }

      externalDependencies.set(specifier, (externalDependencies.get(specifier) || 0) + 1);
    }
  }

  for (const file of files) {
    file.dependencies = [...(adjacency.get(file.path) || [])].sort();
    file.used_by = [...(reverse.get(file.path) || [])].sort();
  }

  return {
    edges: files.flatMap((file) =>
      [...(adjacency.get(file.path) || [])].map((target) => ({
        from: file.path,
        to: target,
        type: "import"
      }))
    ),
    importsByFile: Object.fromEntries(files.map((file) => [file.path, file.dependencies || []])),
    usedByFile: Object.fromEntries(files.map((file) => [file.path, file.used_by || []])),
    externalDependencies: [...externalDependencies.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
  };
}

function buildModuleSummary(files) {
  const modules = new Map();

  for (const file of files) {
    if (!modules.has(file.module)) {
      modules.set(file.module, {
        name: file.module,
        fileCount: 0,
        tags: new Set(),
        sampleFiles: []
      });
    }

    const module = modules.get(file.module);
    module.fileCount += 1;
    for (const tag of file.tags) {
      module.tags.add(tag);
    }
    if (module.sampleFiles.length < 5) {
      module.sampleFiles.push(file.path);
    }
  }

  return [...modules.values()]
    .map((module) => ({
      name: module.name,
      description: `Contains files related to the ${module.name} area of the project.`,
      fileCount: module.fileCount,
      paths: module.sampleFiles.map((item) => item.split("/").slice(0, 2).join("/")),
      tags: [...module.tags].sort(),
      sampleFiles: module.sampleFiles,
      depends_on: []
    }))
    .sort((left, right) => right.fileCount - left.fileCount || left.name.localeCompare(right.name));
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildEntrypoints(projectRoot) {
  const candidates = [
    "package.json",
    "src/index.js",
    "src/main.js",
    "src/server.js",
    "app/page.tsx",
    "app/layout.tsx",
    "src/main/java",
    "manage.py"
  ];

  return candidates
    .filter((relativePath) => pathExists(path.join(projectRoot, relativePath)))
    .map((relativePath) => ({
      path: relativePath,
      reason: "Detected by framework convention or common entrypoint path"
    }));
}

function buildDependencies(projectRoot, techStack) {
  const dependencies = [];
  const packageJsonPath = path.join(projectRoot, "package.json");

  if (pathExists(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const names = dedupe([
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {})
    ]).slice(0, 50);

    dependencies.push(
      ...names.map((name) => ({
        ecosystem: "npm",
        name
      }))
    );
  }

  if (techStack.includes("springboot")) {
    dependencies.push({
      ecosystem: "maven",
      name: "pom.xml",
      note: "Java dependencies managed through Maven build file"
    });
  }

  if (techStack.includes("python")) {
    if (pathExists(path.join(projectRoot, "requirements.txt"))) {
      dependencies.push({
        ecosystem: "pip",
        name: "requirements.txt"
      });
    }

    if (pathExists(path.join(projectRoot, "pyproject.toml"))) {
      dependencies.push({
        ecosystem: "python",
        name: "pyproject.toml"
      });
    }
  }

  return dependencies;
}

function enrichFileRelations(files, recentChanges) {
  const byModule = new Map();
  const byPath = new Map(files.map((file) => [file.path, file]));
  const lastChangedReasonMap = getLastChangedReasonMap(recentChanges);

  for (const file of files) {
    if (!byModule.has(file.module)) {
      byModule.set(file.module, []);
    }
    byModule.get(file.module).push(file.path);
  }

  for (const file of files) {
    const siblings = (byModule.get(file.module) || []).filter((item) => item !== file.path).slice(0, 5);
    const coChanged = [];

    for (const commit of recentChanges.commits || []) {
      if ((commit.files || []).includes(file.path)) {
        for (const relatedPath of commit.files || []) {
          if (relatedPath !== file.path && byPath.has(relatedPath)) {
            coChanged.push(relatedPath);
          }
        }
      }
    }

    file.related_to = dedupe([...siblings, ...coChanged]).slice(0, 8);
    file.last_changed_reason = lastChangedReasonMap.get(file.path) || "";
  }
}

function buildMarkdown(projectMap) {
  const lines = [
    "# Project Context Map",
    "",
    `Generated: ${projectMap.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Project root: \`${projectMap.projectRoot}\``,
    `- Project name: ${projectMap.project_summary.name}`,
    `- Project type: ${projectMap.project_summary.type}`,
    `- Total files indexed: ${projectMap.stats.totalFiles}`,
    `- Tech stack: ${projectMap.tech_stack.length > 0 ? projectMap.tech_stack.join(", ") : "unknown"}`,
    `- Git repo detected: ${projectMap.git.isGitRepo ? "yes" : "no"}`,
    "",
    "## Modules",
    ""
  ];

  for (const module of projectMap.modules.slice(0, 12)) {
    lines.push(
      `- \`${module.name}\`: ${module.fileCount} files${module.tags.length ? `, tags: ${module.tags.join(", ")}` : ""}`
    );
  }

  lines.push("", "## Entrypoints", "");

  for (const entrypoint of projectMap.entrypoints) {
    lines.push(`- \`${entrypoint.path}\`: ${entrypoint.reason}`);
  }

  lines.push("", "## Recent Git Changes", "");

  if (!projectMap.git.isGitRepo) {
    lines.push("- No git repository detected.");
  } else if (projectMap.recent_changes.length === 0) {
    lines.push(`- No commits found in the last ${projectMap.git.days} days.`);
  } else {
    for (const commit of projectMap.recent_changes.slice(0, 10)) {
      lines.push(`- ${commit.date} \`${commit.hash.slice(0, 7)}\` ${commit.summary}`);
    }
  }

  lines.push("", "## Hotspots", "");

  if ((projectMap.hotspots || []).length === 0) {
    lines.push("- No hotspots detected.");
  } else {
    for (const hotspot of projectMap.hotspots.slice(0, 10)) {
      lines.push(`- \`${hotspot.path}\` touched ${hotspot.count} time(s)`);
    }
  }

  lines.push("", "## Important Files", "");

  for (const file of projectMap.files.slice(0, 50)) {
    const summary = file.summary ? ` - ${file.summary}` : "";
    lines.push(`- \`${file.path}\` (${file.role})${summary}`);
  }

  return lines.join("\n");
}

function extractChangeLogSection(existingContent = "") {
  const marker = "## Change Log";
  const index = existingContent.indexOf(marker);
  return index >= 0 ? existingContent.slice(index).trim() : `${marker}\n\n- No logged changes yet.`;
}

function buildProjectContextMarkdown(projectMap, existingContent = "") {
  const mermaidEdges = (projectMap.topology?.edges || []).slice(0, 40);
  const lines = [
    "# Project Context",
    "",
    `Generated: ${projectMap.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Project root: \`${projectMap.projectRoot}\``,
    `- Project name: ${projectMap.project_summary.name}`,
    `- Project type: ${projectMap.project_summary.type}`,
    `- Total files indexed: ${projectMap.stats.totalFiles}`,
    `- Topology edges: ${(projectMap.topology?.edges || []).length}`,
    "",
    "## Key Modules",
    "",
    ...projectMap.modules.slice(0, 10).map((module) => `- \`${module.name}\`: ${module.fileCount} files`),
    "",
    "## Query Index",
    "",
    ...projectMap.files
      .slice(0, 50)
      .map((file) => `- \`${file.path}\`: ${[file.module, file.role, ...(file.tags || [])].filter(Boolean).join(" | ")}`),
    "",
    "## Topology Highlights",
    "",
    ...(projectMap.topology?.edges || []).length > 0
      ? projectMap.topology.edges.slice(0, 30).map((edge) => `- \`${edge.from}\` -> \`${edge.to}\``)
      : ["- No internal import/dependency edges detected."],
    "",
    "## Topology Graph",
    "",
    "```mermaid",
    "graph TD",
    ...(mermaidEdges.length > 0
      ? mermaidEdges.map((edge) => `  ${edge.from.replace(/[^a-zA-Z0-9_]/g, "_")}["${edge.from}"] --> ${edge.to.replace(/[^a-zA-Z0-9_]/g, "_")}["${edge.to}"]`)
      : ["  no_topology_edges[\"No internal topology edges detected\"]"]),
    "```",
    "",
    extractChangeLogSection(existingContent)
  ];

  return lines.join("\n");
}

export function buildProjectMap(projectRootInput) {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const absoluteFiles = walkProjectFiles(projectRoot);
  const files = absoluteFiles.map((filePath) => buildFileRecord(projectRoot, filePath));
  const git = getRecentGitChanges(projectRoot, 5);
  enrichFileRelations(files, git);
  const modules = buildModuleSummary(files);
  const techStack = detectTechStack(projectRoot);
  const projectName = path.basename(projectRoot);
  const topology = buildTopology(projectRoot, files);

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    projectRoot,
    project_summary: {
      name: projectName,
      type: inferProjectType(techStack),
      frameworks: techStack,
      last_updated: new Date().toISOString()
    },
    tech_stack: techStack,
    stats: {
      totalFiles: files.length
    },
    entrypoints: buildEntrypoints(projectRoot),
    dependencies: buildDependencies(projectRoot, techStack),
    topology,
    modules,
    files,
    recent_changes: git.commits,
    hotspots: git.hotspots,
    ownership: {
      manual_overrides_path: ".project-map.overrides.json"
    },
    git
  };
}

export function refreshProjectMap(projectRootInput) {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const projectMap = buildProjectMap(projectRoot);
  const jsonPath = path.join(projectRoot, MAP_JSON_FILE);
  const mdPath = path.join(projectRoot, MAP_MD_FILE);
  const projectMdPath = path.join(projectRoot, PROJECT_MD_FILE);
  const existingProjectMd = readTextIfExists(projectMdPath) || "";

  writeJson(jsonPath, projectMap);
  writeText(mdPath, buildMarkdown(projectMap));
  writeText(projectMdPath, buildProjectContextMarkdown(projectMap, existingProjectMd));

  return {
    jsonPath,
    markdownPath: mdPath,
    projectMarkdownPath: projectMdPath,
    projectMap
  };
}

export function loadProjectMap(projectRootInput) {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const jsonPath = path.join(projectRoot, MAP_JSON_FILE);
  const current = readJsonIfExists(jsonPath);

  if (current) {
    return current;
  }

  return refreshProjectMap(projectRoot).projectMap;
}

export function explainFile(projectRootInput, relativePath) {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const projectMap = loadProjectMap(projectRoot);
  const file = projectMap.files.find((item) => item.path === relativePath);

  if (!file) {
    return null;
  }

  const recentCommits = (projectMap.git.commits || [])
    .filter((commit) => (commit.files || []).includes(relativePath))
    .slice(0, 5)
    .map((commit) => ({
      hash: commit.hash,
      date: commit.date,
      summary: commit.summary
    }));

  return {
    ...file,
    recentCommits
  };
}

export function getModuleContext(projectRootInput, moduleName) {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const projectMap = loadProjectMap(projectRoot);
  const module = (projectMap.modules || []).find(
    (item) => item.name.toLowerCase() === String(moduleName || "").toLowerCase()
  );

  if (!module) {
    return null;
  }

  const files = (projectMap.files || []).filter((file) => file.module === module.name);
  const fileSet = new Set(files.map((file) => file.path));
  const recentCommits = (projectMap.recent_changes || [])
    .filter((commit) => (commit.files || []).some((file) => fileSet.has(file)))
    .slice(0, 10);

  return {
    module,
    files: files.slice(0, 25),
    recentCommits,
    likelyImpactArea: files.slice(0, 8).map((file) => file.path)
  };
}

export function readProjectContext(projectRootInput) {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const projectMdPath = path.join(projectRoot, PROJECT_MD_FILE);

  if (!pathExists(projectMdPath)) {
    refreshProjectMap(projectRoot);
  }

  return {
    path: projectMdPath,
    content: readTextIfExists(projectMdPath) || ""
  };
}

export function readFilesSparse(projectRootInput, filePaths = []) {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const projectMap = loadProjectMap(projectRoot);
  const indexed = new Set((projectMap.files || []).map((file) => file.path));

  const files = filePaths.map((filePath) => {
    const normalizedPath = relativeProjectPath(projectRoot, path.resolve(projectRoot, filePath));
    const absolutePath = path.resolve(projectRoot, filePath);

    if (!isPathInsideProject(projectRoot, absolutePath)) {
      return {
        path: filePath,
        error: "Path is outside the project root."
      };
    }

    if (!indexed.has(normalizedPath)) {
      return {
        path: normalizedPath,
        error: "Path is not indexed in the project topology."
      };
    }

    return {
      path: normalizedPath,
      content: readTextIfExists(absolutePath) || ""
    };
  });

  return { files };
}

export function appendChangeLog(projectRootInput, entry) {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const projectMdPath = path.join(projectRoot, PROJECT_MD_FILE);

  if (!pathExists(projectMdPath)) {
    refreshProjectMap(projectRoot);
  }

  const current = readTextIfExists(projectMdPath) || "# Project Context\n\n## Change Log\n";
  const marker = "## Change Log";
  const timestamp = new Date().toISOString();
  const nextEntry = `- ${timestamp} ${entry}`.trim();

  let updated = current;
  if (!current.includes(marker)) {
    updated = `${current.trim()}\n\n${marker}\n\n${nextEntry}\n`;
  } else if (current.includes("- No logged changes yet.")) {
    updated = current.replace("- No logged changes yet.", nextEntry);
    if (!updated.endsWith("\n")) {
      updated = `${updated}\n`;
    }
  } else {
    updated = `${current.trimEnd()}\n${nextEntry}\n`;
  }

  writeText(projectMdPath, updated.trimEnd());
  return {
    path: projectMdPath,
    entry: nextEntry
  };
}

export function writeAndLog(projectRootInput, targetPath, content, changeSummary = "") {
  const projectRoot = resolveProjectRoot(projectRootInput);
  const absolutePath = path.resolve(projectRoot, targetPath);

  if (!isPathInsideProject(projectRoot, absolutePath)) {
    throw new Error("Refusing to write outside the project root.");
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeText(absolutePath, String(content || "").replace(/\n$/u, ""));

  const normalizedPath = relativeProjectPath(projectRoot, absolutePath);
  const logResult = appendChangeLog(projectRoot, `${normalizedPath}${changeSummary ? ` - ${changeSummary}` : ""}`);

  return {
    path: normalizedPath,
    bytesWritten: Buffer.byteLength(String(content || ""), "utf8"),
    log: logResult
  };
}
