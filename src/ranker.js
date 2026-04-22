import { tokenize } from "./utils.js";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "have",
  "will",
  "need",
  "make",
  "change",
  "changes",
  "file",
  "files",
  "bug",
  "fix"
]);

function scoreTokenMatch(haystack, token, points) {
  return haystack.includes(token) ? points : 0;
}

export function findRelevantFiles(task, projectMap, limit = 8) {
  const rawTokens = tokenize(task).filter((token) => !STOP_WORDS.has(token));
  const tokenSet = [...new Set(rawTokens)];
  const hotspotMap = new Map((projectMap.hotspots || []).map((item) => [item.path, item.count]));
  const recentChangeMap = new Map();

  for (const commit of projectMap.recent_changes || []) {
    for (const filePath of commit.files || []) {
      recentChangeMap.set(filePath, (recentChangeMap.get(filePath) || 0) + 1);
    }
  }

  const ranked = (projectMap.files || [])
    .map((file) => {
      let score = 0;
      const reasons = [];
      const pathLower = (file.path || "").toLowerCase();
      const roleLower = (file.role || "").toLowerCase();
      const summaryLower = (file.summary || "").toLowerCase();
      const tagsLower = (file.tags || []).join(" ").toLowerCase();
      const moduleLower = (file.module || "").toLowerCase();
      const relatedLower = (file.related_to || []).join(" ").toLowerCase();

      for (const token of tokenSet) {
        const tokenScore =
          scoreTokenMatch(pathLower, token, 12) +
          scoreTokenMatch(roleLower, token, 7) +
          scoreTokenMatch(summaryLower, token, 6) +
          scoreTokenMatch(tagsLower, token, 5) +
          scoreTokenMatch(moduleLower, token, 5) +
          scoreTokenMatch(relatedLower, token, 3);

        if (tokenScore > 0) {
          score += tokenScore;
          reasons.push(`matched "${token}"`);
        }
      }

      const hotspotScore = hotspotMap.get(file.path) || 0;
      if (hotspotScore > 0) {
        score += Math.min(hotspotScore * 2, 10);
        reasons.push(`recent hotspot x${hotspotScore}`);
      }

      const recentScore = recentChangeMap.get(file.path) || 0;
      if (recentScore > 0) {
        score += Math.min(recentScore * 2, 8);
        reasons.push(`changed recently x${recentScore}`);
      }

      return {
        path: file.path,
        module: file.module,
        role: file.role,
        score,
        lastChangedReason: file.last_changed_reason || "",
        reasons: [...new Set(reasons)]
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, limit);

  const maxScore = ranked[0]?.score || 0;
  const confidence = maxScore === 0 ? 0 : Math.min(100, Math.round((maxScore / 35) * 100));
  const matchedModules = new Set(ranked.map((item) => item.module).filter(Boolean));
  const avoidReading = (projectMap.modules || [])
    .filter((module) => !matchedModules.has(module.name))
    .slice(0, 5)
    .map((module) => module.name);

  return {
    task,
    tokens: tokenSet,
    confidence,
    matches: ranked,
    avoidReading
  };
}
