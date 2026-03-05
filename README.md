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
- `oxc.oxfmt.formatterPriority`: Priority of formatter provider (default: `1`). Higher priority wins when multiple formatters are registered. Set to `-1` to make it lower priority than other formatters.

## Format on Save

To enable format on save, add this to your coc-config (`:CocConfig`):

```json
{
  "coc.preferences.formatterExtension": "coc-oxc"
}
```

This tells coc.nvim to always use coc-oxc as the formatter, avoiding conflicts with other formatters like coc-biome or coc-prettier.

Alternatively, you can set `oxc.oxfmt.formatterPriority` to control the priority (default `1`, which is higher than most other formatters).

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
