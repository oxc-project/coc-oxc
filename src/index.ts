// Some parts of this extension are inspired by <https://github.com/fannheyward/coc-biome/blob/master/src/index.ts#L50>
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

type CommandGeneralAction = (channel: OutputChannel) => Promise<void> | void;
type CommandClientAction = (client: LanguageClient) => Promise<void> | void;

const CLIENT_ID = "coc-oxc";
const CLIENT_NAME = "oxc";
const OUTPUT_CHANNEL = "oxc";

const GENERAL_COMMANDS: { id: string; action: CommandGeneralAction }[] = [
  {
    id: "oxc.showOutputChannel",
    action: (channel: OutputChannel) => {
      channel.show();
    },
  },
];

const CLIENT_COMMANDS: { id: string; action: CommandClientAction }[] = [
  {
    id: "oxc.restartServer",
    action: async (client: LanguageClient) => {
      if (!client) {
        await window.showErrorMessage("oxc client not found");
        return;
      }

      try {
        await client.restart();
        await window.showInformationMessage("oxc server restarted.");
      } catch (err) {
        client.error("Restarting client failed", err);
      }
    },
  },
];

/***
 * First checks for a user provided binary path in the `oxc.binPath` configuration.
 * Then tries to find a binary from workspace/node_modules/.bin/oxc_language_server,
 * TODO: It should also check for a global installation here!
 * Otherwise returns `null`.
 * @returns The relavant `oxc_language_server` binary for this workspace.
 ***/
function findBinary(): Optional<string> {
  const cfg = workspace.getConfiguration("oxc");
  let bin = cfg.get<string>("binPath", "");
  if (bin && existsSync(bin)) {
    return bin;
  }

  bin = join(workspace.root, "node_modules", ".bin", "oxc_language_server");
  return existsSync(bin) ? bin : null;
}

function serverOptions(): ServerOptions {
  const command = findBinary();
  if (!command) {
    throw [
      `Failed to find "oxc_language_server" binary in the workspace(${workspace.root}).`,
      'You need to either have "oxlint" npm package installed in the root directory of your workspace,',
      'Or set the "oxc.binPath" in your "coc-settings.json".',
    ].join("\n");
  }
  const run: Executable = {
    command,
    options: {
      env: {
        ...process.env,
        RUST_LOG: process.env.RUST_LOG || "info",
      },
    },
  };

  return {
    run,
    // TODO: add debug mode.
    debug: run,
  };
}

function createClient(outputChannel: OutputChannel): LanguageClient {
  const settings: any = JSON.parse(
    JSON.stringify(workspace.getConfiguration("oxc"))
  );
  const clientOptions: LanguageClientOptions = {
    outputChannel,
    progressOnInitialization: true,
    documentSelector: [
      "typescript",
      "javascript",
      "typescriptreact",
      "javascriptreact",
      "vue",
      "svelte",
    ].map((language) => ({
      language,
      scheme: "file",
    })),

    initializationOptions: {
      settings,
    },
  };

  return new LanguageClient(
    CLIENT_ID,
    CLIENT_NAME,
    serverOptions(),
    clientOptions
  );
}

function configureClient(context: ExtensionContext, client: LanguageClient) {
  // add client specific commands.
  context.subscriptions.push(
    ...CLIENT_COMMANDS.map(({ id, action }) =>
      commands.registerCommand(id, () => action(client))
    )
  );

  // add events to handle config updates.
  workspace.onDidChangeConfiguration((e) => {
    if (!e.affectsConfiguration("oxc")) {
      return;
    }

    const settings: any = JSON.parse(
      JSON.stringify(workspace.getConfiguration("oxc"))
    );
    void client.sendNotification("workspace/didChangeConfiguration", { settings });
  });
}

export async function activate(context: ExtensionContext): Promise<void> {
  const enable = workspace.getConfiguration("oxc").get<boolean>("enable", true);
  if (!enable) {
    return;
  }

  const channel = window.createOutputChannel(OUTPUT_CHANNEL);

  const error = (msg: any) => channel.appendLine(`[ERROR]: ${msg}`);

  context.subscriptions.push(
    ...GENERAL_COMMANDS.map(({ id, action }) =>
      commands.registerCommand(id, () => action(channel))
    )
  );

  try {
    const client = createClient(channel);
    configureClient(context, client);
    context.subscriptions.push(services.registerLanguageClient(client));
  } catch (e: unknown) {
    error(e);
  }
}
