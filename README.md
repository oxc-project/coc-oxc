# coc-oxc

[Oxc](https://github.com/oxc-project/oxc) extension for coc.nvim

## Install

`:CocInstall coc-oxc`

## Features

- **oxlint**: Fast linter with auto-fix support
- **oxfmt**: Fast formatter with format-on-save support

> **Note:** This plugin only uses oxlint and oxfmt installed in the respective project; it does not activate globally.

## Configurations

### Oxlint (Linter)

- `oxc.oxlint.enable`: Enable oxlint language server (default: `true`)
- `oxc.oxlint.run`: Run the linter on save `onSave` or on type `onType` (default: `onType`)
- `oxc.oxlint.configPath`: Path to oxlint configuration (default: `null`, searches for `.oxlintrc.json`)
- `oxc.oxlint.binPath`: Path to the `oxlint` binary (default: searches in `node_modules/.bin`)

### Oxfmt (Formatter)

- `oxc.oxfmt.enable`: Enable oxfmt formatting (default: `true`)
- `oxc.oxfmt.binPath`: Path to the `oxfmt` binary (default: searches in `node_modules/.bin`)
- `oxc.oxfmt.formatterPriority`: Priority used when multiple formatters are registered for a language. Higher wins. Set to a negative value to defer to other formatters (default: `1`)

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

oxfmt also registers itself with `oxc.oxfmt.formatterPriority` `1` by default, which outranks any extension that does not set a priority. Tune that value if you need finer control.

You can also format manually with `:call CocAction('format')`

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
