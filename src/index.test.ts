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
    restart = vi.fn(async () => undefined);
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
}));

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

  it("runs oxc.fixAll on save when source.fixAll.oxc is configured", async () => {
    mocks.configurationValues["oxc.oxlint"] = {
      enable: true,
      binPath: "/mock/bin/oxlint",
      codeActionsOnSave: ["source.fixAll.oxc"],
    };
    mocks.configurationValues["oxc.oxfmt"] = { enable: false };
    mocks.existsSync.mockImplementation((path: string) => path === "/mock/bin/oxlint");

    const { activate } = await import("./index");
    await activate({ subscriptions: [] as unknown[] } as never);

    const oxlintClient = mocks.createdClients.find((client) => client.name === "oxlint")!;

    expect(mocks.willSaveListeners).toHaveLength(1);
    const waited: Promise<unknown>[] = [];
    mocks.willSaveListeners[0]({
      document: { uri: "file:///mock/foo.ts", languageId: "typescript" },
      waitUntil: (thenable) => {
        waited.push(Promise.resolve(thenable));
      },
    });
    await Promise.all(waited);

    expect(oxlintClient.sendRequest).toHaveBeenCalledWith("workspace/executeCommand", {
      command: "oxc.fixAll",
      arguments: [{ uri: "file:///mock/foo.ts" }],
    });
  });

  it("skips on-save fix when source.fixAll.oxc is not configured or language does not match", async () => {
    mocks.configurationValues["oxc.oxlint"] = {
      enable: true,
      binPath: "/mock/bin/oxlint",
      codeActionsOnSave: [],
    };
    mocks.configurationValues["oxc.oxfmt"] = { enable: false };
    mocks.existsSync.mockImplementation((path: string) => path === "/mock/bin/oxlint");

    const { activate } = await import("./index");
    await activate({ subscriptions: [] as unknown[] } as never);

    const oxlintClient = mocks.createdClients.find((client) => client.name === "oxlint")!;

    mocks.willSaveListeners[0]({
      document: { uri: "file:///mock/foo.ts", languageId: "typescript" },
      waitUntil: () => {},
    });
    expect(oxlintClient.sendRequest).not.toHaveBeenCalled();

    mocks.configurationValues["oxc.oxlint"].codeActionsOnSave = ["source.fixAll.oxc"];
    mocks.willSaveListeners[0]({
      document: { uri: "file:///mock/foo.css", languageId: "css" },
      waitUntil: () => {},
    });
    expect(oxlintClient.sendRequest).not.toHaveBeenCalled();
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
    expect(context.subscriptions).toHaveLength(0);
  });
});
