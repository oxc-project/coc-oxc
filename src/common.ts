import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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

const execFileAsync = promisify(execFile);

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

async function supportsLsp(command: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(command, ["--help"]);
    return stdout.includes("--lsp");
  } catch {
    return false;
  }
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
  const clientOptions: LanguageClientOptions = {
    outputChannel,
    progressOnInitialization: true,
    documentSelector,
    initializationOptions: {
      settings,
    },
  };

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
}

export function createActivate(config: ClientConfig): (context: ExtensionContext) => Promise<void> {
  return async (context: ExtensionContext): Promise<void> => {
    const enable = workspace.getConfiguration(`oxc.${config.name}`).get<boolean>("enable", true);
    if (!enable) {
      return;
    }

    const command = findBinary(config);
    if (!command) {
      return;
    }

    if (!(await supportsLsp(command))) {
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
