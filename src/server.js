#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import {
  explainFile,
  getModuleContext,
  loadProjectMap,
  readFilesSparse,
  readProjectContext,
  refreshProjectMap,
  writeAndLog
} from "./indexer.js";
import { getRecentGitChanges } from "./git.js";
import { findRelevantFiles } from "./ranker.js";
import { resolveProjectRoot } from "./utils.js";

function asTextResult(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

function getRoot(args) {
  return resolveProjectRoot(args?.projectRoot);
}

export function createServer() {
  return new Server(
    {
      name: "project-context-map",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {}
      },
      instructions:
        "Use project map tools before reading many files. Prefer get_project_summary and find_relevant_files first, then inspect only the returned files."
    }
  );
}

const server = createServer();

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "read_project_context",
        description: "Returns the generated .project.md content for the repository.",
        inputSchema: {
          type: "object",
          properties: {
            projectRoot: {
              type: "string",
              description: "Optional project root. Defaults to PROJECT_ROOT or current working directory."
            }
          }
        }
      },
      {
        name: "query_topology",
        description:
          "Takes a natural language query and returns matched file paths from the query index, along with import/dependency topology context.",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            projectRoot: {
              type: "string",
              description: "Optional project root. Defaults to PROJECT_ROOT or current working directory."
            },
            query: {
              type: "string",
              description: "Natural-language query."
            },
            limit: {
              type: "number",
              description: "Maximum number of file paths to return.",
              default: 8
            }
          }
        }
      },
      {
        name: "read_files_sparse",
        description:
          "Read only a small set of indexed files. Rejects paths that are outside the project root or missing from the project topology.",
        inputSchema: {
          type: "object",
          required: ["paths"],
          properties: {
            projectRoot: {
              type: "string",
              description: "Optional project root. Defaults to PROJECT_ROOT or current working directory."
            },
            paths: {
              type: "array",
              items: { type: "string" },
              description: "Repository-relative file paths."
            }
          }
        }
      },
      {
        name: "write_and_log",
        description: "Writes file content and appends an entry to the .project.md Change Log.",
        inputSchema: {
          type: "object",
          required: ["path", "content"],
          properties: {
            projectRoot: {
              type: "string",
              description: "Optional project root. Defaults to PROJECT_ROOT or current working directory."
            },
            path: {
              type: "string",
              description: "Repository-relative path to write."
            },
            content: {
              type: "string",
              description: "Full file content to write."
            },
            summary: {
              type: "string",
              description: "Short Change Log summary."
            }
          }
        }
      },
      {
        name: "get_project_summary",
        description:
          "Load the current project context map and return the project summary, modules, stack, and hotspots.",
        inputSchema: {
          type: "object",
          properties: {
            projectRoot: {
              type: "string",
              description: "Optional project root. Defaults to PROJECT_ROOT or current working directory."
            }
          }
        }
      },
      {
        name: "refresh_project_map",
        description:
          "Regenerate .project-map.json and .project-map.md for the current repository.",
        inputSchema: {
          type: "object",
          properties: {
            projectRoot: {
              type: "string",
              description: "Optional project root. Defaults to PROJECT_ROOT or current working directory."
            }
          }
        }
      },
      {
        name: "get_module_context",
        description:
          "Return context for a module or feature area, including module summary, files, recent commits, and likely impact paths.",
        inputSchema: {
          type: "object",
          required: ["module"],
          properties: {
            projectRoot: {
              type: "string",
              description: "Optional project root. Defaults to PROJECT_ROOT or current working directory."
            },
            module: {
              type: "string",
              description: "Module or feature name."
            }
          }
        }
      },
      {
        name: "find_relevant_files",
        description:
          "Rank the most relevant files for a natural-language task so the coding agent can open only a small subset.",
        inputSchema: {
          type: "object",
          required: ["task"],
          properties: {
            projectRoot: {
              type: "string",
              description: "Optional project root. Defaults to PROJECT_ROOT or current working directory."
            },
            task: {
              type: "string",
              description: "Natural-language change request, bug description, or feature request."
            },
            limit: {
              type: "number",
              description: "Maximum number of files to return.",
              default: 8
            }
          }
        }
      },
      {
        name: "get_recent_git_changes",
        description:
          "Summarize git commits and hotspots from the last N days. Default is 5 days.",
        inputSchema: {
          type: "object",
          properties: {
            projectRoot: {
              type: "string",
              description: "Optional project root. Defaults to PROJECT_ROOT or current working directory."
            },
            days: {
              type: "number",
              description: "How many days of git history to inspect.",
              default: 5
            }
          }
        }
      },
      {
        name: "explain_file_role",
        description:
          "Explain why a file exists, which module it belongs to, and whether it changed recently.",
        inputSchema: {
          type: "object",
          required: ["path"],
          properties: {
            projectRoot: {
              type: "string",
              description: "Optional project root. Defaults to PROJECT_ROOT or current working directory."
            },
            path: {
              type: "string",
              description: "Repository-relative file path."
            }
          }
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  if (name === "read_project_context") {
    return asTextResult(readProjectContext(getRoot(args)));
  }

  if (name === "query_topology") {
    const projectMap = loadProjectMap(getRoot(args));
    const result = findRelevantFiles(args.query, projectMap, Number(args.limit || 8));
    const matchedPaths = result.matches.map((item) => item.path);
    const topology = matchedPaths.map((filePath) => {
      const file = projectMap.files.find((item) => item.path === filePath);
      return {
        path: filePath,
        module: file?.module || "",
        dependencies: file?.dependencies || [],
        usedBy: file?.used_by || []
      };
    });

    return asTextResult({
      query: args.query,
      matchedPaths,
      confidence: result.confidence,
      matches: result.matches,
      topology
    });
  }

  if (name === "read_files_sparse") {
    return asTextResult(readFilesSparse(getRoot(args), args.paths || []));
  }

  if (name === "write_and_log") {
    return asTextResult(writeAndLog(getRoot(args), args.path, args.content, args.summary || ""));
  }

  if (name === "get_project_summary") {
    const projectMap = loadProjectMap(getRoot(args));
    return asTextResult({
      projectRoot: projectMap.projectRoot,
      generatedAt: projectMap.generatedAt,
      projectSummary: projectMap.project_summary,
      techStack: projectMap.tech_stack,
      stats: projectMap.stats,
      entrypoints: projectMap.entrypoints,
      topModules: projectMap.modules.slice(0, 12),
      hotspots: (projectMap.hotspots || []).slice(0, 10)
    });
  }

  if (name === "refresh_project_map") {
    const result = refreshProjectMap(getRoot(args));
    return asTextResult({
      message: "Project map refreshed.",
      jsonPath: result.jsonPath,
      markdownPath: result.markdownPath,
      projectMarkdownPath: result.projectMarkdownPath,
      generatedAt: result.projectMap.generatedAt,
      totalFiles: result.projectMap.stats.totalFiles
    });
  }

  if (name === "get_module_context") {
    const result = getModuleContext(getRoot(args), args.module);

    if (!result) {
      return asTextResult({
        error: `Module not found in project map: ${args.module}`
      });
    }

    return asTextResult(result);
  }

  if (name === "find_relevant_files") {
    const projectMap = loadProjectMap(getRoot(args));
    const result = findRelevantFiles(args.task, projectMap, Number(args.limit || 8));
    return asTextResult(result);
  }

  if (name === "get_recent_git_changes") {
    const result = getRecentGitChanges(getRoot(args), Number(args.days || 5));
    return asTextResult(result);
  }

  if (name === "explain_file_role") {
    const result = explainFile(getRoot(args), args.path);

    if (!result) {
      return asTextResult({
        error: `File not found in project map: ${args.path}`
      });
    }

    return asTextResult(result);
  }

  throw new Error(`Unknown tool: ${name}`);
});

export async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startServer();
}
