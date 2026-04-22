import { execFileSync } from "node:child_process";

function runGit(projectRoot, args) {
  return execFileSync("git", ["-C", projectRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
}

export function isGitRepository(projectRoot) {
  try {
    return runGit(projectRoot, ["rev-parse", "--is-inside-work-tree"]) === "true";
  } catch {
    return false;
  }
}

export function getRecentGitChanges(projectRoot, days = 5) {
  if (!isGitRepository(projectRoot)) {
    return {
      isGitRepo: false,
      days,
      commits: [],
      hotspots: []
    };
  }

  const output = runGit(projectRoot, [
    "log",
    `--since=${days} days ago`,
    "--date=short",
    "--pretty=format:__COMMIT__%n%H%n%ad%n%s",
    "--name-only"
  ]);

  if (!output) {
    return {
      isGitRepo: true,
      days,
      commits: [],
      hotspots: []
    };
  }

  const blocks = output
    .split("__COMMIT__")
    .map((block) => block.trim())
    .filter(Boolean);

  const hotspotCounter = new Map();
  const commits = blocks.map((block) => {
    const lines = block
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);

    const [hash, date, summary, ...files] = lines;

    for (const filePath of files) {
      hotspotCounter.set(filePath, (hotspotCounter.get(filePath) || 0) + 1);
    }

    return {
      hash,
      date,
      summary,
      files
    };
  });

  const hotspots = [...hotspotCounter.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((left, right) => right.count - left.count || left.path.localeCompare(right.path))
    .slice(0, 25);

  return {
    isGitRepo: true,
    days,
    commits,
    hotspots
  };
}

export function getLastChangedReasonMap(gitChanges) {
  const result = new Map();

  for (const commit of gitChanges?.commits || []) {
    for (const filePath of commit.files || []) {
      if (!result.has(filePath)) {
        result.set(filePath, commit.summary);
      }
    }
  }

  return result;
}
