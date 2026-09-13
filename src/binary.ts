import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { binaryNames, detectVitePlusProject } from "./detectVitePlus";

export type ToolName = "oxlint" | "oxfmt";
export type BinarySource = "auto" | "vite-plus" | "oxc";

export interface Binary {
  command: string;
  cwd: string;
  vitePlus: boolean;
}

function configuredBinary(path: string, root: string): string | undefined {
  const absolute = resolve(root, path);
  const candidates =
    process.platform === "win32" && !extname(absolute)
      ? [...binaryNames(absolute), absolute]
      : [absolute];
  return candidates.find(existsSync);
}

export function findBinary(
  name: ToolName,
  root: string,
  binPath: string,
  source: BinarySource,
  vpPath: string,
): Binary | undefined {
  // Explicit standalone paths have priority over every source selection.
  if (binPath) {
    const command = configuredBinary(binPath, root);
    if (!command) throw new Error(`Invalid ${name} binary: ${binPath}. Check oxc.${name}.binPath.`);
    return { command, cwd: root, vitePlus: false };
  }

  if (source !== "oxc") {
    if (vpPath) {
      const command = configuredBinary(vpPath, root);
      if (!command) throw new Error(`Invalid Vite+ binary: ${vpPath}. Check oxc.vp.binPath.`);
      return { command, cwd: root, vitePlus: true };
    }
    const project = detectVitePlusProject(root, source === "vite-plus");
    if (project) {
      if (!project.vpPath) {
        throw new Error(
          `Vite+ selected in ${project.root}, but no vp binary was found. Run your package manager's install command (for example, pnpm install), or set oxc.vp.binPath, then run ${name}.restartServer.`,
        );
      }
      return { command: project.vpPath, cwd: project.root, vitePlus: true };
    }
  }

  const command = binaryNames(name)
    .map((bin) => join(root, "node_modules", ".bin", bin))
    .find(existsSync);
  return command ? { command, cwd: root, vitePlus: false } : undefined;
}
