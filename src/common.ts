import { pathToFileURL } from "node:url";
import {
  Disposable,
  Executable,
  ExtensionContext,
  LanguageClient,
  LanguageClientOptions,
  OutputChannel,
  State,
  commands,
  services,
  window,
  workspace,
} from "coc.nvim";
import { Binary, BinarySource, findBinary, ToolName } from "./binary";

export interface ClientConfig {
  name: ToolName;
  languages: string[];
}

const shutdowns = new Set<() => Promise<void>>();

export async function deactivate(): Promise<void> {
  await Promise.all([...shutdowns].map((shutdown) => shutdown()));
}

function clientOutputChannel(channel: OutputChannel): OutputChannel {
  // The extension owns the channel across client failures and restarts.
  return {
    name: channel.name,
    get content() {
      return channel.content;
    },
    append: (value) => channel.append(value),
    appendLine: (value) => channel.appendLine(value),
    clear: (keep) => channel.clear(keep),
    show: (preserveFocus) => channel.show(preserveFocus),
    hide: () => channel.hide(),
    dispose: () => {},
  };
}

function getSettings(
  config: ClientConfig,
  uri: string,
  vitePlus: boolean,
): Record<string, unknown> {
  const settings = JSON.parse(
    JSON.stringify(workspace.getConfiguration(`oxc.${config.name}`, uri)),
  );
  if (config.name === "oxfmt") {
    return {
      "fmt.experimental": settings.enable ?? true,
      ...(settings.binPath ? { "fmt.binPath": settings.binPath } : {}),
      "fmt.disableNestedConfig": vitePlus || (settings.disableNestedConfig ?? false),
    };
  }
  return { ...settings, disableNestedConfig: vitePlus || (settings.disableNestedConfig ?? false) };
}

export function createServerOptions(
  config: ClientConfig,
  binary: Binary,
): { run: Executable; debug: Executable } {
  const isWindows = process.platform === "win32";
  const run: Executable = {
    command: isWindows ? `"${binary.command}"` : binary.command,
    args: binary.vitePlus ? [config.name === "oxlint" ? "lint" : "fmt", "--lsp"] : ["--lsp"],
    options: {
      cwd: binary.cwd,
      shell: isWindows,
      env: {
        ...process.env,
        RUST_LOG: process.env.RUST_LOG || "info",
      },
    },
  };
  return { run, debug: run };
}

function createClient(
  config: ClientConfig,
  binary: Binary,
  root: string,
  outputChannel: OutputChannel,
): LanguageClient {
  const uri = pathToFileURL(root).href;
  const clientOptions: LanguageClientOptions = {
    outputChannel: clientOutputChannel(outputChannel),
    progressOnInitialization: true,
    documentSelector: config.languages.map((language) => ({ language, scheme: "file" })),
    initializationOptions: [
      { workspaceUri: uri, options: getSettings(config, uri, binary.vitePlus) },
    ],
    middleware: {
      workspace: {
        configuration: (params) =>
          params.items.map((item) =>
            item.section === "oxc_language_server"
              ? getSettings(config, item.scopeUri ?? uri, binary.vitePlus)
              : null,
          ),
      },
    },
  };
  if (config.name === "oxlint") {
    clientOptions.diagnosticPullOptions = {
      onChange: true,
      onSave: true,
      filter: (document, mode) =>
        mode === "onType" &&
        workspace.getConfiguration("oxc.oxlint", document.uri).get<string>("run", "onType") ===
          "onSave",
    };
  }
  if (config.name === "oxfmt") {
    clientOptions.formatterPriority = workspace
      .getConfiguration("oxc.oxfmt", uri)
      .get<number>("formatterPriority", 1);
  }
  return new LanguageClient(
    config.name,
    config.name,
    createServerOptions(config, binary),
    clientOptions,
  );
}

export function createActivate(config: ClientConfig): (context: ExtensionContext) => Promise<void> {
  return async (context) => {
    // The RFC defines coc-oxc detection at the editor root, not the active file.
    const root = workspace.root;
    const uri = pathToFileURL(root).href;
    const section = `oxc.${config.name}`;
    const channel = window.createOutputChannel(config.name);
    let client: LanguageClient | undefined;
    let binary: Binary | undefined;
    let registration: Disposable | undefined;
    let stateListener: Disposable | undefined;
    let disposed = false;
    let queue = Promise.resolve();

    const reportError = (error: unknown) => {
      const message = `${config.name}: ${error instanceof Error ? error.message : String(error)}`;
      channel.appendLine(message);
      void window.showErrorMessage(message);
    };

    async function stop() {
      const previous = client;
      client = undefined;
      binary = undefined;
      stateListener?.dispose();
      stateListener = undefined;
      try {
        await previous?.dispose();
      } finally {
        registration?.dispose();
        registration = undefined;
      }
    }

    function enqueue(action: () => Promise<void>): Promise<void> {
      queue = queue
        .then(async () => {
          if (!disposed) await action();
        })
        .catch(reportError);
      return queue;
    }

    async function start() {
      await stop();
      if (disposed) return;
      const settings = workspace.getConfiguration(section, uri);
      if (!settings.get<boolean>("enable", true)) return;
      binary = findBinary(
        config.name,
        root,
        settings.get<string>("binPath", ""),
        settings.get<BinarySource>("binarySource", "auto"),
        workspace.getConfiguration("oxc.vp", uri).get<string>("binPath", ""),
      );
      if (!binary) {
        channel.appendLine(
          `No local ${config.name} binary found. Install it, then run ${config.name}.restartServer.`,
        );
        return;
      }
      channel.appendLine(
        `Using ${binary.command}${binary.vitePlus ? ` ${config.name === "oxlint" ? "lint" : "fmt"}` : ""} --lsp (cwd: ${binary.cwd})`,
      );
      client = createClient(config, binary, root, channel);
      if (binary.vitePlus) {
        stateListener = client.onDidChangeState((event) => {
          if (event.newState === State.StartFailed) {
            reportError(
              `Vite+ failed to start. Check the output and upgrade vite-plus to a version that supports ${config.name === "oxlint" ? "lint" : "fmt"} --lsp, then run ${config.name}.restartServer.`,
            );
          }
        });
      }
      registration = services.registerLanguageClient(client);
    }

    let shutdown: Promise<void> | undefined;
    const dispose = () => {
      if (shutdown) return shutdown;
      disposed = true;
      shutdown = queue
        .then(stop)
        .catch(reportError)
        .finally(() => {
          channel.dispose();
          shutdowns.delete(dispose);
        });
      return shutdown;
    };
    shutdowns.add(dispose);

    context.subscriptions.push(
      commands.registerCommand(`${config.name}.showOutputChannel`, () => {
        // Coc can leave an empty buffer after concurrent startup failures.
        if (!client?.isRunning()) channel.hide();
        channel.show();
      }),
      commands.registerCommand(`${config.name}.restartServer`, () => enqueue(start)),
      workspace.onDidChangeConfiguration((event) => {
        const settings = workspace.getConfiguration(section, uri);
        const usesVpSetting =
          !settings.get<string>("binPath", "") &&
          settings.get<BinarySource>("binarySource", "auto") !== "oxc";
        const needsRestart =
          ["enable", "binPath", "binarySource", "formatterPriority"].some((key) =>
            event.affectsConfiguration(`${section}.${key}`),
          ) ||
          (usesVpSetting && event.affectsConfiguration("oxc.vp.binPath"));
        if (needsRestart) {
          void enqueue(start);
        } else if (event.affectsConfiguration(section)) {
          void enqueue(async () => {
            if (!client || !binary) return;
            const activeClient = client;
            const settings = [
              { workspaceUri: uri, options: getSettings(config, uri, binary.vitePlus) },
            ];
            activeClient.clientOptions.initializationOptions = settings;
            // An in-flight initialize request already contains the previous settings.
            if (activeClient.state === State.Starting) {
              await activeClient.onReady();
            }
            if (!disposed && client === activeClient && activeClient.isRunning()) {
              await activeClient.sendNotification("workspace/didChangeConfiguration", { settings });
            }
          });
        }
      }),
      { dispose },
    );

    if (config.name === "oxlint") {
      context.subscriptions.push(
        workspace.onWillSaveTextDocument((event) => {
          if (!client?.isRunning() || !config.languages.includes(event.document.languageId)) return;
          const kinds = workspace
            .getConfiguration(section, event.document.uri)
            .get<string[]>("codeActionsOnSave", []);
          if (!kinds.includes("source.fixAll.oxc")) return;
          const activeClient = client;
          event.waitUntil(
            activeClient
              .sendRequest("workspace/executeCommand", {
                command: "oxc.fixAll",
                arguments: [{ uri: event.document.uri }],
              })
              .catch((error) => activeClient.error("codeActionsOnSave failed", error)),
          );
        }),
      );
    }

    await enqueue(start);
  };
}
