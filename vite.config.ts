import { defineConfig } from "vite";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function getGitOutput(command: string): string | null {
  try {
    return execSync(command, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function getRepositorySlug(): string {
  const envRepository = process.env.GITHUB_REPOSITORY?.trim();
  if (envRepository) return envRepository;

  const remoteUrl = getGitOutput("git config --get remote.origin.url") ?? "";
  const githubMatch = remoteUrl.match(/github\.com[:/]([^/]+\/[^/]+)$/);
  return githubMatch?.[1].replace(/\.git$/, "") ?? "";
}

const sourceCommit = getGitOutput("git rev-parse --short=12 HEAD") ?? "unknown";
const sourceDirty = Boolean(getGitOutput("git status --short"));
const sourceVersion = `${sourceCommit}${sourceDirty ? "-dirty" : ""}`;
const fossEarthSource = (path: string): string => fileURLToPath(new URL(`../foss-earth/src/${path}`, import.meta.url));

export default defineConfig({
  base: "/foss-earth-oil/",
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __SOURCE_VERSION__: JSON.stringify(sourceVersion),
    __REPOSITORY_SLUG__: JSON.stringify(getRepositorySlug()),
  },
  resolve: {
    alias: [
      { find: "foss-earth/layers", replacement: fossEarthSource("layers/types.ts") },
      { find: "foss-earth/cameraMath", replacement: fossEarthSource("camera/cameraMath.ts") },
      { find: "foss-earth/style.css", replacement: fossEarthSource("styles/globe.css") },
      { find: "foss-earth", replacement: fossEarthSource("index.ts") },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
