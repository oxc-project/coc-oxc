import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  const configurationValues: Record<string, Record<string, unknown>> = {};
  const createdClients: MockLanguageClient[] = [];
  const registeredClients: MockLanguageClient[] = [];
  const registeredCommands: Array<{
    name: string;
    handler: (...args: unknown[]) => unknown;
  }> = [];
  const outputChannels: Array<{ name: string; show: ReturnType<typeof vi.fn> }> = [];
  const configurationListeners: Array<
    (event: { affectsConfiguration: (section: string) => boolean }) => void
  > = [];
  const promisifyCustom = Symbol.for("nodejs.util.promisify.custom");

  class MockLanguageClient {
    id: string;
    name: string;
    serverOptions: Record<string, unknown>;
    clientOptions: Record<string, unknown>;
    restart = vi.fn(async () => undefined);
    sendNotification = vi.fn();
    error = vi.fn();

    constructor(
      id: string,
      name: string,
      serverOptions: Record<string, unknown>,
      clientOptions: Record<string, unknown>,
    ) {
      this.id = id;
      this.name = name;
      this.serverOptions = serverOptions;
      this.clientOptions = clientOptions;
      createdClients.push(this);
    }
  }

  const execFile = vi.fn();
  const execFileAsync = vi.fn();
  Object.defineProperty(execFile, promisifyCustom, { value: execFileAsync });

  const existsSync = vi.fn((_path: string) => false);

  const commands = {
    registerCommand: vi.fn((name: string, handler: (...args: unknown[]) => unknown) => {
      registeredCommands.push({ name, handler });
      return { dispose: vi.fn() };
    }),
  };

  const services = {
    registerLanguageClient: vi.fn((client: MockLanguageClient) => {
      registeredClients.push(client);
      return { dispose: vi.fn() };
    }),
  };

  const window = {
    createOutputChannel: vi.fn((name: string) => {
      const channel = { name, show: vi.fn() };
      outputChannels.push(channel);
      return channel;
    }),
    showErrorMessage: vi.fn(async () => undefined),
    showInformationMessage: vi.fn(async () => undefined),
  };

  const workspace = {
    root: "/mock-workspace",
    getConfiguration: vi.fn((section: string) => {
      const values = configurationValues[section] ? { ...configurationValues[section] } : {};
      return {
        ...values,
        get<T>(key: string, fallback?: T): T {
          return key in values ? (values[key] as T) : (fallback as T);
        },
      };
    }),
    onDidChangeConfiguration: vi.fn(
      (listener: (event: { affectsConfiguration: (section: string) => boolean }) => void) => {
        configurationListeners.push(listener);
        return { dispose: vi.fn() };
      },
    ),
  };

  function reset() {
    for (const key of Object.keys(configurationValues)) {
      delete configurationValues[key];
    }

    configurationValues["oxc.oxlint"] = {
      enable: true,
      binPath: "",
      run: "onType",
      configPath: null,
    };
    configurationValues["oxc.oxfmt"] = {
      enable: true,
      binPath: "",
    };

    createdClients.length = 0;
    registeredClients.length = 0;
    registeredCommands.length = 0;
    outputChannels.length = 0;
    configurationListeners.length = 0;

    execFile.mockClear();
    execFileAsync.mockReset();
    execFileAsync.mockResolvedValue({ stdout: "--lsp", stderr: "" });
    existsSync.mockReset();
    existsSync.mockImplementation((_path: string) => false);

    commands.registerCommand.mockClear();
    services.registerLanguageClient.mockClear();
    window.createOutputChannel.mockClear();
    window.showErrorMessage.mockClear();
    window.showInformationMessage.mockClear();
    workspace.getConfiguration.mockClear();
    workspace.onDidChangeConfiguration.mockClear();
  }

  return {
    configurationValues,
    createdClients,
    registeredClients,
    registeredCommands,
    outputChannels,
    configurationListeners,
    promisifyCustom,
    execFile,
    execFileAsync,
    existsSync,
    commands,
    services,
    window,
    workspace,
    MockLanguageClient,
    reset,
  };
});

vi.mock("node:child_process", () => ({
  execFile: mocks.execFile,
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
}));

vi.mock("node:util", async () => {
  const actual = await vi.importActual<typeof import("node:util")>("node:util");
  return {
    ...actual,
    promisify: vi.fn((fn: Record<PropertyKey, unknown>) => {
      return fn[mocks.promisifyCustom] as unknown;
    }),
  };
});

vi.mock("coc.nvim", () => ({
  LanguageClient: mocks.MockLanguageClient,
  commands: mocks.commands,
  services: mocks.services,
  window: mocks.window,
  workspace: mocks.workspace,
}));

beforeEach(() => {
  vi.resetModules();
  mocks.reset();
});

describe("extension activation", () => {
  it("registers both clients with the expected initialization options", async () => {
    mocks.configurationValues["oxc.oxlint"] = {
      enable: true,
      binPath: "",
      run: "onSave",
      configPath: "/mock/oxlint.json",
    };
    mocks.configurationValues["oxc.oxfmt"] = {
      enable: true,
      binPath: "/mock/bin/oxfmt",
    };
    mocks.existsSync.mockImplementation(
      (path: string) =>
        path === "/mock-workspace/node_modules/.bin/oxlint" || path === "/mock/bin/oxfmt",
    );

    const { activate } = await import("./index");
    const context = { subscriptions: [] as unknown[] };

    await activate(context as never);

    expect(mocks.createdClients.map((client) => client.name)).toEqual(["oxlint", "oxfmt"]);
    expect(mocks.registeredClients).toHaveLength(2);
    expect(mocks.registeredCommands.map((command) => command.name)).toEqual([
      "oxlint.showOutputChannel",
      "oxlint.restartServer",
      "oxfmt.showOutputChannel",
      "oxfmt.restartServer",
    ]);
    expect(mocks.execFileAsync).toHaveBeenCalledTimes(2);

    const [oxlintClient, oxfmtClient] = mocks.createdClients;
    expect(oxlintClient.serverOptions).toMatchObject({
      run: {
        command: "/mock-workspace/node_modules/.bin/oxlint",
        args: ["--lsp"],
      },
    });
    expect(oxlintClient.clientOptions).toMatchObject({
      initializationOptions: [
        {
          workspaceUri: "file:///mock-workspace",
          options: {
            enable: true,
            binPath: "",
            run: "onSave",
            configPath: "/mock/oxlint.json",
          },
        },
      ],
    });
    expect(oxfmtClient.serverOptions).toMatchObject({
      run: {
        command: "/mock/bin/oxfmt",
        args: ["--lsp"],
      },
    });
    expect(oxfmtClient.clientOptions).toMatchObject({
      initializationOptions: [
        {
          workspaceUri: "file:///mock-workspace",
          options: {
            "fmt.experimental": true,
            "fmt.binPath": "/mock/bin/oxfmt",
          },
        },
      ],
    });
  });

  it("skips activation for disabled clients", async () => {
    mocks.configurationValues["oxc.oxlint"] = {
      enable: false,
      binPath: "/mock/bin/oxlint",
    };
    mocks.existsSync.mockImplementation((path: string) => path === "/mock/bin/oxlint");

    const { createActivate } = await import("./common");
    const context = { subscriptions: [] as unknown[] };

    await createActivate({
      name: "oxlint",
      languages: ["typescript"],
    })(context as never);

    expect(mocks.createdClients).toHaveLength(0);
    expect(mocks.registeredClients).toHaveLength(0);
    expect(mocks.registeredCommands).toHaveLength(0);
    expect(mocks.execFileAsync).not.toHaveBeenCalled();
    expect(context.subscriptions).toHaveLength(0);
  });
});
