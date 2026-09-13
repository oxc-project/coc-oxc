import { existsSync, readFileSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";

export interface VitePlusProject {
  /** The ancestor that directly declares vite-plus, or the explicitly selected root. */
  root: string;
  /** Missing when Vite+ is selected but no local or global vp is installed. */
  vpPath?: string;
}

interface PackageJson {
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  workspaces?: unknown;
}

function readPackageJson(dir: string): PackageJson | null {
  try {
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

function isRootWorkspace(dir: string, pkg: PackageJson | null): boolean {
  return (
    existsSync(join(dir, "pnpm-workspace.yaml")) ||
    existsSync(join(dir, "lerna.json")) ||
    Boolean(pkg?.workspaces)
  );
}

export function binaryNames(name: string): string[] {
  return process.platform === "win32" ? [`${name}.cmd`, `${name}.exe`] : [name];
}

function findInDirectory(dir: string): string | undefined {
  return binaryNames("vp")
    .map((name) => join(dir, name))
    .find(existsSync);
}

/** RFC #1614: identity, bounded local lookup, then PATH lookup after opt-in.
 * coc-oxc starts at workspace.root, which can be inside the monorepo root.
 * https://github.com/voidzero-dev/vite-plus/pull/1614
 */
export function detectVitePlusProject(start: string, force = false): VitePlusProject | null {
  let dir = resolve(start);
  let pkg = readPackageJson(dir);
  if (!force) {
    while (!pkg?.dependencies?.["vite-plus"] && !pkg?.devDependencies?.["vite-plus"]) {
      const parent = dirname(dir);
      if (isRootWorkspace(dir, pkg) || parent === dir) return null;
      dir = parent;
      pkg = readPackageJson(dir);
    }
  }

  const root = dir;
  while (true) {
    const vpPath = findInDirectory(join(dir, "node_modules", ".bin"));
    if (vpPath) return { root, vpPath };
    const parent = dirname(dir);
    if (isRootWorkspace(dir, pkg) || parent === dir) break;
    dir = parent;
    pkg = readPackageJson(dir);
  }

  const pathKey =
    process.platform === "win32"
      ? Object.keys(process.env).find((key) => key.toLowerCase() === "path")
      : "PATH";
  const searchPath = (pathKey && process.env[pathKey]) || "";
  for (const entry of searchPath.split(delimiter)) {
    if (!entry) continue;
    const vpPath = findInDirectory(resolve(start, entry));
    if (vpPath) return { root, vpPath };
  }
  return { root };
}
