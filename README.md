# coc-oxc

[Oxc](https://github.com/oxc-project/oxc) extension for coc.nvim

## Install

`:CocInstall coc-oxc`

## Features

- **oxlint**: Fast linter with auto-fix support
- **oxfmt**: Fast formatter with format-on-save support
- **Vite+**: Detect Vite+ projects and run `vp lint --lsp` and `vp fmt --lsp`

Standalone oxlint and oxfmt are resolved from the project's `node_modules/.bin`, unless an explicit binary path is configured.

## Vite+ projects

The extension detects a direct `vite-plus` dependency in `dependencies` or `devDependencies`. Detection starts at Coc's `workspace.root` and walks up to the monorepo root, including that directory. A monorepo root contains `pnpm-workspace.yaml`, `package.json#workspaces`, or `lerna.json`. Detection does not search child packages or follow active-file changes.

For a detected project, the extension searches for `node_modules/.bin/vp` from the declaring package up to the monorepo root. If no local binary exists, it searches `PATH`. Windows uses `vp.cmd` or `vp.exe`. A transitive installation or global `vp` alone does not make a project Vite+.

If Vite+ is selected but no binary is available, the extension shows an install hint and leaves that server stopped. Install the project dependencies, then run `:CocCommand oxlint.restartServer` and `:CocCommand oxfmt.restartServer`. Startup failures show an upgrade hint. Both restart commands repeat binary detection.

Select the source independently for each tool:

```json
{
  "oxc.oxlint.binarySource": "oxc",
  "oxc.oxfmt.binarySource": "vite-plus"
}
```

- `auto` (default): Detect a direct Vite+ dependency; otherwise use the standalone tool.
- `vite-plus`: Use Vite+ without requiring a dependency declaration.
- `oxc`: Use the standalone tool and ignore `oxc.vp.binPath`.

Set `oxc.vp.binPath` to an absolute path or a path relative to `workspace.root` to select a specific `vp` executable. This selects Vite+ for tools set to `auto` or `vite-plus`. An explicit `oxc.oxlint.binPath` or `oxc.oxfmt.binPath` takes priority over all source selections for that tool. Invalid explicit paths produce an error.

Source and binary-path changes restart the affected servers. Vite+ servers always receive `disableNestedConfig: true` (`fmt.disableNestedConfig` for formatting) so they use Vite+ configuration. This does not change saved settings; standalone servers use the configured value.

## Configurations

### Oxlint (Linter)

- `oxc.oxlint.enable`: Enable oxlint language server (default: `true`)
- `oxc.oxlint.run`: Run the linter on save `onSave` or on type `onType` (default: `onType`)
- `oxc.oxlint.configPath`: Path to oxlint configuration (default: `null`, searches for `.oxlintrc.json`)
- `oxc.oxlint.binPath`: Path to the `oxlint` binary (default: searches in `node_modules/.bin`)
- `oxc.oxlint.binarySource`: Binary source: `auto`, `vite-plus`, or `oxc` (default: `auto`)
- `oxc.oxlint.disableNestedConfig`: Disable nested configuration (default: `false`; always `true` with Vite+)
- `oxc.oxlint.codeActionsOnSave`: Code action kinds to apply on save, e.g. `["source.fixAll.oxc"]` (default: `[]`, disabled)

### Oxfmt (Formatter)

- `oxc.oxfmt.enable`: Enable oxfmt formatting (default: `true`)
- `oxc.oxfmt.binPath`: Path to the `oxfmt` binary (default: searches in `node_modules/.bin`)
- `oxc.oxfmt.binarySource`: Binary source: `auto`, `vite-plus`, or `oxc` (default: `auto`)
- `oxc.oxfmt.disableNestedConfig`: Disable nested configuration (default: `false`; always `true` with Vite+)
- `oxc.oxfmt.formatterPriority`: Priority used when multiple formatters are registered for a language. Only positive values boost; the default `1` outranks formatters that do not set a priority. To defer for a given language, use `coc.preferences.formatterExtension` instead (default: `1`)

## Format on Save

To enable format on save, add this to your coc-config (`:CocConfig`):

```json
{
  "oxc.oxfmt.enable": true,
  "coc.preferences.formatterExtension": "coc-oxc"
}
```

`coc.preferences.formatterExtension` tells coc.nvim to use coc-oxc whenever it is available, which avoids conflicts with other extensions that also register an LSP formatter (e.g. `coc-biome`, `coc-tsserver`, `coc-prettier`). You can scope it per-language if you want a different formatter for some files:

```json
{
  "[json]": { "coc.preferences.formatterExtension": "coc-prettier" }
}
```

oxfmt also registers itself with `oxc.oxfmt.formatterPriority` `1` by default, which outranks any extension that does not set a priority.

You can also format manually with `:call CocAction('format')`

## Fix on Save

To apply oxlint's auto-fixes on save, add this to your coc-config (`:CocConfig`):

```json
{
  "oxc.oxlint.codeActionsOnSave": ["source.fixAll.oxc"]
}
```

## Commands

### Oxlint Commands

- `oxlint.restartServer`: Restart oxlint Server
- `oxlint.showOutputChannel`: Show oxlint Output Channel

### Oxfmt Commands

- `oxfmt.restartServer`: Restart oxfmt Server
- `oxfmt.showOutputChannel`: Show oxfmt Output Channel

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)

# [Sponsored By](https://oxc.rs/sponsor)

<p align="center">
  <a href="https://oxc.rs/sponsor">
    <img src="https://raw.githubusercontent.com/oxc-project/sponsors/main/sponsors.svg" alt="Our sponsors" />
  </a>
</p>
