import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { binaryNames, detectVitePlusProject } from "./detectVitePlus";
import { findBinary } from "./binary";

let root: string;
const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
function file(relative: string, content = ""): string {
  const target = join(root, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  return target;
}
function pkg(
  relative = "",
  value: object = { devDependencies: { "vite-plus": "latest" } },
): string {
  return file(join(relative, "package.json"), JSON.stringify(value));
}
function shim(relative = "", name = "vp"): string {
  return file(join(relative, "node_modules/.bin", binaryNames(name)[0]));
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "coc-oxc-detection-"));
  file("pnpm-workspace.yaml");
  vi.stubEnv("PATH", "");
});
afterEach(() => {
  Object.defineProperty(process, "platform", platform);
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe("RFC conformance", () => {
  it("root-declared-and-installed", () => {
    pkg();
    const vpPath = shim();
    expect(detectVitePlusProject(root)).toEqual({ root, vpPath });
  });
  it("pnpm-subpackage-declared-root-hoisted", () => {
    pkg("packages/app");
    const vpPath = shim();
    expect(detectVitePlusProject(join(root, "packages/app"))).toEqual({
      root: join(root, "packages/app"),
      vpPath,
    });
  });
  it("npm-subpackage-direct-dep-unhoisted", () => {
    rmSync(join(root, "pnpm-workspace.yaml"));
    pkg("", { workspaces: ["packages/*"] });
    pkg("packages/app", { dependencies: { "vite-plus": "latest" } });
    const vpPath = shim("packages/app");
    expect(detectVitePlusProject(join(root, "packages/app"))).toEqual({
      root: join(root, "packages/app"),
      vpPath,
    });
  });
  it("root-declared-no-local-no-global", () => {
    pkg();
    expect(detectVitePlusProject(root)).toEqual({ root });
  });
  it("root-declared-no-local-global-on-path", () => {
    pkg();
    const vpPath = file(join("global", binaryNames("vp")[0]));
    vi.stubEnv("PATH", dirname(vpPath));
    expect(detectVitePlusProject(root)).toEqual({ root, vpPath });
  });
  it("transitive-install", () => {
    pkg("", { dependencies: { unrelated: "latest" } });
    pkg("node_modules/vite-plus", { name: "vite-plus" });
    shim();
    expect(detectVitePlusProject(root)).toBeNull();
  });
  it("global-vp-without-declaration", () => {
    pkg("", {});
    vi.stubEnv("PATH", dirname(file(join("global", binaryNames("vp")[0]))));
    expect(detectVitePlusProject(root)).toBeNull();
  });
  it("plain-non-vite-plus", () => {
    pkg("", { peerDependencies: { "vite-plus": "*" }, optionalDependencies: { "vite-plus": "*" } });
    expect(detectVitePlusProject(root)).toBeNull();
  });
  it("yarn4-pnp", () => {
    pkg();
    file(".pnp.cjs", "throw new Error('must not execute PnP code')");
    expect(detectVitePlusProject(root)).toEqual({ root });
  });
  it.each(["pnpm-workspace.yaml", "lerna.json", "package.json"])(
    "parent-vite-plus-nested-repo (%s)",
    (marker) => {
      pkg();
      shim();
      file(`nested/${marker}`, marker === "package.json" ? '{"workspaces":[]}' : "");
      expect(detectVitePlusProject(join(root, "nested/src"))).toBeNull();
    },
  );
});

describe("lookup bounds and precedence", () => {
  it.each(["pnpm-workspace.yaml", "lerna.json", "package.json"])(
    "does not resolve a binary above %s",
    (marker) => {
      shim();
      pkg("nested", {
        dependencies: { "vite-plus": "*" },
        ...(marker === "package.json" ? { workspaces: [] } : {}),
      });
      if (marker !== "package.json") file(`nested/${marker}`);
      expect(detectVitePlusProject(join(root, "nested"))).toEqual({ root: join(root, "nested") });
    },
  );
  it("prefers the nearest declaration and install over hoisted and global binaries", () => {
    pkg();
    shim();
    pkg("packages/app");
    const vpPath = shim("packages/app");
    vi.stubEnv("PATH", dirname(file(join("global", binaryNames("vp")[0]))));
    expect(detectVitePlusProject(join(root, "packages/app/src"))).toEqual({
      root: join(root, "packages/app"),
      vpPath,
    });
  });
  it.each(["{", "null", "[]", '"string"'])(
    "tolerates malformed or non-object package JSON: %s",
    (content) => {
      pkg();
      const vpPath = shim();
      file("src/package.json", content);
      expect(detectVitePlusProject(join(root, "src"))).toEqual({ root, vpPath });
    },
  );
  it("forced selection skips identity but respects the lookup bound", () => {
    shim();
    file("nested/pnpm-workspace.yaml");
    expect(detectVitePlusProject(join(root, "nested"), true)).toEqual({
      root: join(root, "nested"),
    });
  });
  it("rechecks installations after a previous miss or removal", () => {
    pkg();
    expect(detectVitePlusProject(root)).toEqual({ root });
    const vpPath = shim();
    expect(detectVitePlusProject(root)).toEqual({ root, vpPath });
    rmSync(vpPath);
    expect(detectVitePlusProject(root)).toEqual({ root });
  });
  it("prefers Windows vp.cmd over vp.exe and ignores the POSIX shim", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    pkg();
    file("node_modules/.bin/vp");
    file("node_modules/.bin/vp.exe");
    const vpPath = shim();
    expect(detectVitePlusProject(root)).toEqual({ root, vpPath });
  });
  it("uses a local Bun vp.exe before a hoisted vp.cmd", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    pkg("app");
    shim();
    const vpPath = file("app/node_modules/.bin/vp.exe");
    expect(detectVitePlusProject(join(root, "app"))).toEqual({ root: join(root, "app"), vpPath });
  });
  it("reads Windows Path casing for global fallback", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    pkg();
    vi.stubEnv("PATH", undefined);
    const vpPath = file("global/vp.exe");
    vi.stubEnv("Path", dirname(vpPath));
    expect(detectVitePlusProject(root)).toEqual({ root, vpPath });
  });
});

describe("binary source selection", () => {
  it.each(["oxlint", "oxfmt"] as const)(
    "preserves standalone %s lookup in plain projects",
    (tool) => {
      const command = shim("", tool);
      shim();
      expect(findBinary(tool, root, "", "auto", "")).toEqual({
        command,
        cwd: root,
        vitePlus: false,
      });
    },
  );
  it("does not silently fall back when Vite+ is declared but missing", () => {
    pkg();
    shim("", "oxlint");
    expect(() => findBinary("oxlint", root, "", "auto", "")).toThrow("pnpm install");
  });
  it("an explicit standalone binary overrides Vite+ detection and settings", () => {
    pkg();
    const command = file("custom/oxlint");
    expect(findBinary("oxlint", root, "custom/oxlint", "vite-plus", "missing")).toEqual({
      command,
      cwd: root,
      vitePlus: false,
    });
  });
  it("an invalid explicit standalone binary produces an error", () => {
    shim();
    expect(() => findBinary("oxlint", root, "missing", "vite-plus", "")).toThrow(
      "oxc.oxlint.binPath",
    );
  });
  it.each(["auto", "vite-plus"] as const)("an explicit vp path opts in with %s", (source) => {
    const command = file("custom/vp");
    expect(findBinary("oxfmt", root, "", source, "custom/vp")).toEqual({
      command,
      cwd: root,
      vitePlus: true,
    });
  });
  it("standalone source ignores an explicit vp path and direct declaration", () => {
    pkg();
    const command = shim("", "oxlint");
    expect(findBinary("oxlint", root, "", "oxc", "missing")).toEqual({
      command,
      cwd: root,
      vitePlus: false,
    });
  });
  it("forced Vite+ uses a local binary without a declaration", () => {
    const command = shim();
    expect(findBinary("oxfmt", root, "", "vite-plus", "")).toEqual({
      command,
      cwd: root,
      vitePlus: true,
    });
  });
  it("an invalid explicit vp path produces an error instead of fallback", () => {
    shim("", "oxfmt");
    expect(() => findBinary("oxfmt", root, "", "auto", "missing")).toThrow("oxc.vp.binPath");
  });
});
