import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { join } from "path";

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
  const willSaveListeners: Array<
    (event: {
      document: { uri: string; languageId: string };
      waitUntil: (thenable: Promise<unknown>) => void;
    }) => void
  > = [];

  class MockLanguageClient {
    id: string;
    name: string;
    serverOptions: Record<string, unknown>;
    clientOptions: Record<string, unknown>;
    dispose = vi.fn(async () => undefined);
    isRunning = vi.fn(() => true);
    onDidChangeState = vi.fn((_listener: (event: { newState: number }) => void) => ({
      dispose: vi.fn(),
    }));
    sendNotification = vi.fn();
    sendRequest = vi.fn(async (_method: string, _params: unknown) => null as unknown);
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

  const existsSync = vi.fn((_path: string) => false);
  const readFileSync = vi.fn((_path: string) => "{}");

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
      const channel = { name, show: vi.fn(), appendLine: vi.fn(), dispose: vi.fn() };
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
    onWillSaveTextDocument: vi.fn(
      (
        listener: (event: {
          document: { uri: string; languageId: string };
          waitUntil: (thenable: Promise<unknown>) => void;
        }) => void,
      ) => {
        willSaveListeners.push(listener);
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
    willSaveListeners.length = 0;

    readFileSync.mockReset();
    readFileSync.mockReturnValue("{}");
    existsSync.mockReset();
    existsSync.mockImplementation((_path: string) => false);

    commands.registerCommand.mockClear();
    services.registerLanguageClient.mockClear();
    window.createOutputChannel.mockClear();
    window.showErrorMessage.mockClear();
    window.showInformationMessage.mockClear();
    workspace.getConfiguration.mockClear();
    workspace.onDidChangeConfiguration.mockClear();
    workspace.onWillSaveTextDocument.mockClear();
  }

  return {
    configurationValues,
    createdClients,
    registeredClients,
    registeredCommands,
    outputChannels,
    configurationListeners,
    willSaveListeners,
    existsSync,
    readFileSync,
    commands,
    services,
    window,
    workspace,
    MockLanguageClient,
    reset,
  };
});

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
  readFileSync: mocks.readFileSync,
}));

vi.mock("coc.nvim", () => ({
  LanguageClient: mocks.MockLanguageClient,
  State: { StartFailed: 4 },
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
    mocks.existsSync.mockImplementation((path: string) => {
      const p = path.replace(/\\/g, "/");
      return p === "/mock-workspace/node_modules/.bin/oxlint" || p === "/mock/bin/oxfmt";
    });

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

    const [oxlintClient, oxfmtClient] = mocks.createdClients;
    expect(oxlintClient.serverOptions).toMatchObject({
      run: {
        command: join("/mock-workspace", "node_modules", ".bin", "oxlint"),
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
      formatterPriority: 1,
    });
    expect(oxlintClient.clientOptions).not.toHaveProperty("formatterPriority");
  });

  it("honors a configured oxfmt formatterPriority", async () => {
    mocks.configurationValues["oxc.oxlint"] = { enable: false };
    mocks.configurationValues["oxc.oxfmt"] = {
      enable: true,
      binPath: "/mock/bin/oxfmt",
      formatterPriority: 5,
    };
    mocks.existsSync.mockImplementation((path: string) => path === "/mock/bin/oxfmt");

    const { activate } = await import("./index");
    await activate({ subscriptions: [] as unknown[] } as never);

    const oxfmtClient = mocks.createdClients.find((client) => client.name === "oxfmt");
    expect(oxfmtClient?.clientOptions).toMatchObject({ formatterPriority: 5 });
  });

  it.each([
    {
      name: "runs oxc.fixAll when source.fixAll.oxc is configured and language matches",
      kinds: ["source.fixAll.oxc"],
      languageId: "typescript",
      expectRequest: true,
    },
    {
      name: "skips when codeActionsOnSave is empty",
      kinds: [],
      languageId: "typescript",
      expectRequest: false,
    },
    {
      name: "skips when language is not in the oxlint document selector",
      kinds: ["source.fixAll.oxc"],
      languageId: "css",
      expectRequest: false,
    },
  ])("$name", async ({ kinds, languageId, expectRequest }) => {
    mocks.configurationValues["oxc.oxlint"] = {
      enable: true,
      binPath: "/mock/bin/oxlint",
      codeActionsOnSave: kinds,
    };
    mocks.configurationValues["oxc.oxfmt"] = { enable: false };
    mocks.existsSync.mockImplementation((path: string) => path === "/mock/bin/oxlint");

    const { activate } = await import("./index");
    await activate({ subscriptions: [] as unknown[] } as never);

    const oxlintClient = mocks.createdClients.find((client) => client.name === "oxlint")!;
    const waited: Promise<unknown>[] = [];
    mocks.willSaveListeners[0]({
      document: { uri: "file:///mock/foo", languageId },
      waitUntil: (thenable) => {
        waited.push(Promise.resolve(thenable));
      },
    });
    await Promise.all(waited);

    if (expectRequest) {
      expect(oxlintClient.sendRequest).toHaveBeenCalledWith("workspace/executeCommand", {
        command: "oxc.fixAll",
        arguments: [{ uri: "file:///mock/foo" }],
      });
    } else {
      expect(oxlintClient.sendRequest).not.toHaveBeenCalled();
    }
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
    expect(mocks.registeredCommands.map((command) => command.name)).toEqual([
      "oxlint.showOutputChannel",
      "oxlint.restartServer",
    ]);
    expect(context.subscriptions.length).toBeGreaterThan(0);
  });
});

async function changeConfiguration(key: string) {
  for (const listener of mocks.configurationListeners) {
    listener({
      affectsConfiguration: (section) => key === section || key.startsWith(`${section}.`),
    });
  }
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function restart(tool = "oxlint") {
  await mocks.registeredCommands
    .find((command) => command.name === `${tool}.restartServer`)!
    .handler();
}

async function activateVitePlus() {
  mocks.readFileSync.mockImplementation((path) =>
    path === "/mock-workspace/package.json" ? '{"devDependencies":{"vite-plus":"*"}}' : "{}",
  );
  mocks.existsSync.mockImplementation((path) => path === "/mock-workspace/node_modules/.bin/vp");
  const { activate } = await import("./index");
  const context = { subscriptions: [] as Array<{ dispose: () => unknown }> };
  await activate(context as never);
  return context;
}

function serverSettings(client: (typeof mocks.createdClients)[number]) {
  return (
    client.clientOptions.initializationOptions as Array<{ options: Record<string, unknown> }>
  )[0].options;
}

function requestSettings(client: (typeof mocks.createdClients)[number]) {
  const middleware = client.clientOptions.middleware as {
    workspace: {
      configuration: (params: {
        items: Array<{ section: string; scopeUri?: string }>;
      }) => unknown[];
    };
  };
  return middleware.workspace.configuration({
    items: [
      { section: "oxc_language_server", scopeUri: "file:///mock-workspace" },
      { section: "unrelated" },
    ],
  });
}

describe("Vite+ client lifecycle", () => {
  it("launches lint and fmt subcommands and disables nested config without editing settings", async () => {
    mocks.configurationValues["oxc.oxlint"].disableNestedConfig = false;
    mocks.configurationValues["oxc.oxfmt"].disableNestedConfig = false;
    await activateVitePlus();
    for (const [index, tool] of ["lint", "fmt"].entries()) {
      const client = mocks.createdClients[index];
      expect(client.serverOptions).toMatchObject({
        run: {
          command: "/mock-workspace/node_modules/.bin/vp",
          args: [tool, "--lsp"],
          options: { cwd: "/mock-workspace" },
        },
      });
      const key = tool === "lint" ? "disableNestedConfig" : "fmt.disableNestedConfig";
      expect(serverSettings(client)[key]).toBe(true);
      expect(requestSettings(client)).toEqual([serverSettings(client), null]);
    }
    expect(mocks.configurationValues["oxc.oxlint"].disableNestedConfig).toBe(false);
    expect(mocks.configurationValues["oxc.oxfmt"].disableNestedConfig).toBe(false);
  });

  it("uses the declaring ancestor as cwd when the editor opens a subdirectory", async () => {
    mocks.readFileSync.mockImplementation((path) =>
      path === "/package.json" ? '{"dependencies":{"vite-plus":"*"}}' : "{}",
    );
    mocks.existsSync.mockImplementation((path) => path === "/node_modules/.bin/vp");
    const { activate } = await import("./index");
    await activate({ subscriptions: [] } as never);
    expect(mocks.createdClients[0].serverOptions).toMatchObject({ run: { options: { cwd: "/" } } });
    expect(mocks.createdClients[0].clientOptions).toMatchObject({
      initializationOptions: [{ workspaceUri: "file:///mock-workspace" }],
    });
  });

  it("updates running servers with the same effective configuration as initialization", async () => {
    await activateVitePlus();
    const [lint, fmt] = mocks.createdClients;
    mocks.configurationValues["oxc.oxlint"].run = "onSave";
    await changeConfiguration("oxc.oxlint.run");
    await changeConfiguration("oxc.oxfmt.disableNestedConfig");
    expect(mocks.createdClients).toHaveLength(2);
    for (const client of [lint, fmt]) {
      expect(client.sendNotification).toHaveBeenCalledWith("workspace/didChangeConfiguration", {
        settings: client.clientOptions.initializationOptions,
      });
      expect(requestSettings(client)[0]).toEqual(serverSettings(client));
    }
    expect(serverSettings(lint)).toMatchObject({ run: "onSave", disableNestedConfig: true });
    expect(serverSettings(fmt)).toMatchObject({ "fmt.disableNestedConfig": true });
  });

  it("changes only the selected tool and restores standalone nested-config behavior", async () => {
    await activateVitePlus();
    const [lint, fmt] = mocks.createdClients;
    mocks.existsSync.mockImplementation((path) => path.endsWith("/vp") || path.endsWith("/oxlint"));
    mocks.configurationValues["oxc.oxlint"].binarySource = "oxc";
    await changeConfiguration("oxc.oxlint.binarySource");
    expect(lint.dispose).toHaveBeenCalledOnce();
    expect(fmt.dispose).not.toHaveBeenCalled();
    expect(mocks.createdClients).toHaveLength(3);
    const replacement = mocks.createdClients[2];
    expect(replacement.serverOptions).toMatchObject({ run: { args: ["--lsp"] } });
    expect(serverSettings(replacement).disableNestedConfig).toBe(false);
    expect(requestSettings(replacement)[0]).toEqual(serverSettings(replacement));
    mocks.configurationValues["oxc.oxlint"].disableNestedConfig = true;
    await changeConfiguration("oxc.oxlint.disableNestedConfig");
    expect(serverSettings(replacement).disableNestedConfig).toBe(true);
  });

  it("re-resolves an explicit vp path and leaves tools with standalone overrides running", async () => {
    mocks.configurationValues["oxc.oxlint"].binPath = "/custom/oxlint";
    mocks.configurationValues["oxc.vp"] = { binPath: "/custom/vp" };
    mocks.existsSync.mockReturnValue(true);
    const { activate } = await import("./index");
    await activate({ subscriptions: [] } as never);
    const [lint, fmt] = mocks.createdClients;
    mocks.configurationValues["oxc.vp"].binPath = "/new/vp";
    await changeConfiguration("oxc.vp.binPath");
    expect(lint.dispose).not.toHaveBeenCalled();
    expect(fmt.dispose).toHaveBeenCalledOnce();
    expect(mocks.createdClients[2].serverOptions).toMatchObject({
      run: { command: "/new/vp", args: ["fmt", "--lsp"] },
    });
  });

  it("keeps the standalone source running when the shared vp setting changes", async () => {
    mocks.configurationValues["oxc.oxlint"].binarySource = "oxc";
    mocks.configurationValues["oxc.oxfmt"].enable = false;
    mocks.existsSync.mockImplementation((path) => path.endsWith("/oxlint"));
    const { activate } = await import("./index");
    await activate({ subscriptions: [] } as never);
    await changeConfiguration("oxc.vp.binPath");
    expect(mocks.createdClients).toHaveLength(1);
    expect(mocks.createdClients[0].dispose).not.toHaveBeenCalled();
  });

  it("recovers after a missing install without reloading or silently using standalone", async () => {
    mocks.configurationValues["oxc.oxlint"].binarySource = "vite-plus";
    mocks.configurationValues["oxc.oxfmt"].enable = false;
    mocks.existsSync.mockImplementation((path) => path.endsWith("/oxlint"));
    const { activate } = await import("./index");
    await activate({ subscriptions: [] } as never);
    expect(mocks.createdClients).toHaveLength(0);
    expect(mocks.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("pnpm install"),
    );
    mocks.existsSync.mockImplementation((path) => path.endsWith("/vp"));
    await restart();
    expect(mocks.createdClients).toHaveLength(1);
    expect(mocks.createdClients[0].serverOptions).toMatchObject({
      run: { args: ["lint", "--lsp"] },
    });
  });

  it("surfaces startup failures and permits a fresh client on restart", async () => {
    await activateVitePlus();
    const failed = mocks.createdClients[0];
    failed.onDidChangeState.mock.calls[0][0]({ newState: 4 });
    expect(mocks.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("upgrade vite-plus"),
    );
    await restart();
    expect(failed.dispose).toHaveBeenCalledOnce();
    expect(mocks.createdClients[2].name).toBe("oxlint");
    expect(mocks.registeredCommands).toHaveLength(4);
  });

  it("refreshes the output channel after restart because Coc disposes client channels", async () => {
    await activateVitePlus();
    const firstChannel = mocks.outputChannels[0];
    await restart();
    await mocks.registeredCommands
      .find((command) => command.name === "oxlint.showOutputChannel")!
      .handler();
    expect(firstChannel.show).not.toHaveBeenCalled();
    expect(mocks.outputChannels.at(-1)!.show).toHaveBeenCalledOnce();
  });

  it("can enable and disable a server after activation", async () => {
    mocks.configurationValues["oxc.oxlint"].enable = false;
    await activateVitePlus();
    expect(mocks.createdClients.map((client) => client.name)).toEqual(["oxfmt"]);
    mocks.configurationValues["oxc.oxlint"].enable = true;
    await changeConfiguration("oxc.oxlint.enable");
    expect(mocks.createdClients[1].name).toBe("oxlint");
    mocks.configurationValues["oxc.oxlint"].enable = false;
    await changeConfiguration("oxc.oxlint.enable");
    expect(mocks.createdClients[1].dispose).toHaveBeenCalledOnce();
    expect(mocks.createdClients).toHaveLength(2);
  });

  it("serializes concurrent restarts and releases registrations even if disposal fails", async () => {
    await activateVitePlus();
    const registration = mocks.services.registerLanguageClient.mock.results[0].value;
    mocks.createdClients[0].dispose.mockRejectedValueOnce(new Error("dispose failed"));
    await Promise.all([restart(), restart()]);
    expect(registration.dispose).toHaveBeenCalledOnce();
    expect(mocks.createdClients).toHaveLength(3);
    expect(mocks.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("dispose failed"),
    );
  });

  it("disposes clients and listeners and does not start queued work after deactivation", async () => {
    const context = await activateVitePlus();
    const pending = restart();
    await Promise.all(context.subscriptions.map((subscription) => subscription.dispose()));
    await pending;
    expect(mocks.createdClients).toHaveLength(2);
    for (const client of mocks.createdClients) expect(client.dispose).toHaveBeenCalledOnce();
    for (const result of mocks.workspace.onDidChangeConfiguration.mock.results)
      expect(result.value.dispose).toHaveBeenCalledOnce();
    for (const result of mocks.workspace.onWillSaveTextDocument.mock.results)
      expect(result.value.dispose).toHaveBeenCalledOnce();
  });
});

describe("server launch options", () => {
  it("quotes Windows executable paths and passes Vite+ arguments separately", async () => {
    const { createServerOptions } = await import("./common");
    const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
    try {
      Object.defineProperty(process, "platform", { value: "win32" });
      const options = createServerOptions(
        { name: "oxlint", languages: [] },
        {
          command: "C:\\my project\\node_modules\\.bin\\vp.cmd",
          cwd: "C:\\my project",
          vitePlus: true,
        },
      );
      expect(options.run).toMatchObject({
        command: '"C:\\my project\\node_modules\\.bin\\vp.cmd"',
        args: ["lint", "--lsp"],
        options: { cwd: "C:\\my project", shell: true },
      });
      expect(options.debug).toBe(options.run);
    } finally {
      Object.defineProperty(process, "platform", platform);
    }
  });
});
