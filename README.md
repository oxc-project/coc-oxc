# coc-oxc

[Oxc](https://github.com/oxc-project/oxc) extension for coc.nvim

## Install

`:CocInstall coc-oxc`

## Features

- **oxlint**: Fast linter with auto-fix support
- **oxfmt**: Fast formatter with format-on-save support

## Configurations

### Oxlint (Linter)

* `oxc.oxlint.enable`: Enable oxlint language server (default: `true`)
* `oxc.oxlint.run`: Run the linter on save `onSave` or on type `onType` (default: `onType`)
* `oxc.oxlint.configPath`: Path to oxlint configuration (default: `null`, searches for `.oxlintrc.json`)
* `oxc.oxlint.binPath`: Path to the `oxlint` binary (default: searches in `node_modules/.bin`)

### Oxfmt (Formatter)

* `oxc.oxfmt.enable`: Enable oxfmt formatting (default: `true`)
* `oxc.oxfmt.binPath`: Path to the `oxfmt` binary (default: searches in `node_modules/.bin`)

## Format on Save

To enable format on save, add this to your coc-config (`:CocConfig`):

```json
{
  "oxc.oxfmt.enable": true,
  "coc.preferences.formatOnSaveFiletypes": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ]
}
```

You can also format manually with `:call CocAction('format')`

## Commands

### Oxlint Commands

* `oxlint.restartServer`: Restart oxlint Server
* `oxlint.showOutputChannel`: Show oxlint Output Channel

### Oxfmt Commands

* `oxfmt.restartServer`: Restart oxfmt Server
* `oxfmt.showOutputChannel`: Show oxfmt Output Channel

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
