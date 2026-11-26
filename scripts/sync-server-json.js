#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, "package.json");
const serverJsonPath = path.join(rootDir, "server.json");

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const serverJson = JSON.parse(fs.readFileSync(serverJsonPath, "utf8"));

serverJson.version = packageJson.version;

if (Array.isArray(serverJson.packages)) {
  for (const pkg of serverJson.packages) {
    if (pkg && typeof pkg === "object") {
      pkg.version = packageJson.version;
    }
  }
}

fs.writeFileSync(serverJsonPath, `${JSON.stringify(serverJson, null, 2)}\n`, "utf8");
process.stdout.write(`Synced server.json to version ${packageJson.version}\n`);
