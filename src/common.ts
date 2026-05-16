import { existsSync } from "node:fs";
import { join } from "path";
import {
  Executable,
  ExtensionContext,
  LanguageClient,
  LanguageClientOptions,
  OutputChannel,
  ServerOptions,
  commands,
  services,
  window,
  workspace,
} from "coc.nvim";

type Optional<T> = T | null;

export interface ClientConfig {
  name: string;
  languages: string[];
}

function findBinary(config: ClientConfig): Optional<string> {
  const cfg = workspace.getConfiguration(`oxc.${config.name}`);
  let bin = cfg.get<string>("binPath", "");
  if (bin && existsSync(bin)) {
    return bin;
  }

  bin = join(workspace.root, "node_modules", ".bin", config.name);
  return existsSync(bin) ? bin : null;
}

function createServerOptions(command: string): ServerOptions {
  const run: Executable = {
    command,
    args: ["--lsp"],
    options: {
      env: {
        ...process.env,
        RUST_LOG: process.env.RUST_LOG || "info",
      },
    },
  };

  return {
    run,
    debug: run,
  };
}

function createClient(
  config: ClientConfig,
  command: string,
  outputChannel: OutputChannel,
): LanguageClient {
  const settings: any = JSON.parse(
    JSON.stringify(workspace.getConfiguration(`oxc.${config.name}`)),
  );
  const documentSelector = config.languages.map((language) => ({
    language,
    scheme: "file",
  }));

  const options: Record<string, any> = {};
  const initializationOptions = [
    {
      workspaceUri: `file://${workspace.root}`,
      options,
    },
  ];
  const clientOptions: LanguageClientOptions = {
    outputChannel,
    progressOnInitialization: true,
    documentSelector,
    initializationOptions,
  };

  if (config.name === "oxfmt") {
    if (settings.enable !== undefined) {
      options["fmt.experimental"] = settings.enable;
    }
    if (settings.binPath) {
      options["fmt.binPath"] = settings.binPath;
    }
    clientOptions.formatterPriority = settings.formatterPriority ?? 1;
  } else if (config.name === "oxlint") {
    Object.assign(options, settings);
  }

  return new LanguageClient(config.name, config.name, createServerOptions(command), clientOptions);
}

function configureClient(config: ClientConfig, context: ExtensionContext, client: LanguageClient) {
  context.subscriptions.push(
    commands.registerCommand(`${config.name}.restartServer`, async () => {
      if (!client) {
        await window.showErrorMessage(`${config.name} client not found`);
        return;
      }
      try {
        await client.restart();
        await window.showInformationMessage(`${config.name} server restarted.`);
      } catch (err) {
        client.error("Restarting client failed", err);
      }
    }),
  );

  workspace.onDidChangeConfiguration((e) => {
    if (!e.affectsConfiguration(`oxc.${config.name}`)) {
      return;
    }

    const settings: any = JSON.parse(
      JSON.stringify(workspace.getConfiguration(`oxc.${config.name}`)),
    );
    void client.sendNotification("workspace/didChangeConfiguration", { settings });
  });

  if (config.name === "oxlint") {
    context.subscriptions.push(
      workspace.onWillSaveTextDocument((event) => {
        if (!config.languages.includes(event.document.languageId)) {
          return;
        }
        const kinds = workspace
          .getConfiguration("oxc.oxlint", event.document.uri)
          .get<string[]>("codeActionsOnSave", []);
        if (!kinds.includes("source.fixAll.oxc")) {
          return;
        }
        event.waitUntil(
          client
            .sendRequest("workspace/executeCommand", {
              command: "oxc.fixAll",
              arguments: [{ uri: event.document.uri }],
            })
            .catch((err) => client.error("codeActionsOnSave failed", err)),
        );
      }),
    );
  }
}

export function createActivate(config: ClientConfig): (context: ExtensionContext) => Promise<void> {
  return async (context: ExtensionContext): Promise<void> => {
    const cfg = workspace.getConfiguration(`oxc.${config.name}`);
    const enable = cfg.get<boolean>("enable", true);
    if (!enable) {
      return;
    }

    const command = findBinary(config);
    if (!command) {
      return;
    }

    const channel = window.createOutputChannel(config.name);

    context.subscriptions.push(
      commands.registerCommand(`${config.name}.showOutputChannel`, () => {
        channel.show();
      }),
    );

    const client = createClient(config, command, channel);
    configureClient(config, context, client);
    context.subscriptions.push(services.registerLanguageClient(client));
  };
}
