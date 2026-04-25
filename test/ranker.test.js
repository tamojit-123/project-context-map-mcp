import { describe, expect, test } from "@jest/globals";
import { findRelevantFiles } from "../src/ranker.js";

describe("findRelevantFiles", () => {
  test("ranks matches using task tokens, hotspots, and recent changes", () => {
    const projectMap = {
      files: [
        {
          path: "src/auth-service.js",
          module: "auth",
          role: "Business logic service",
          summary: "Handles login and session validation",
          tags: ["auth", "api"],
          related_to: ["src/auth-controller.js"]
        },
        {
          path: "src/payments.js",
          module: "payments",
          role: "Application or tooling source file",
          summary: "Charges cards",
          tags: ["payment"],
          related_to: []
        }
      ],
      modules: [{ name: "auth" }, { name: "payments" }, { name: "docs" }],
      hotspots: [{ path: "src/auth-service.js", count: 3 }],
      recent_changes: [
        {
          hash: "abc123",
          files: ["src/auth-service.js", "src/auth-controller.js"]
        },
        {
          hash: "def456",
          files: ["src/auth-service.js"]
        }
      ]
    };

    const result = findRelevantFiles("Fix login auth bug in the service", projectMap, 5);

    expect(result.tokens).toEqual(["login", "auth", "service"]);
    expect(result.matches[0]).toMatchObject({
      path: "src/auth-service.js",
      module: "auth"
    });
    expect(result.matches[0].score).toBeGreaterThan(0);
    expect(result.matches[0].reasons).toEqual(
      expect.arrayContaining(['matched "login"', 'matched "auth"', 'matched "service"', "recent hotspot x3", "changed recently x2"])
    );
    expect(result.avoidReading).toEqual(["payments", "docs"]);
    expect(result.confidence).toBeGreaterThan(0);
  });

  test("returns empty matches and zero confidence when nothing is relevant", () => {
    const result = findRelevantFiles(
      "Update dashboard styles",
      {
        files: [{ path: "src/api.js", module: "api", role: "API integration or boundary", summary: "", tags: [], related_to: [] }],
        modules: [{ name: "api" }],
        hotspots: [],
        recent_changes: []
      },
      3
    );

    expect(result.matches).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.avoidReading).toEqual(["api"]);
  });
});
