# coc-oxc

Oxc extension for coc.nvim

## Install

`:CocInstall coc-oxc`

## Configurations

* `oxc.run`[`onSave`, `onType`]: Run the linter on save or on type (default: `onType`).
* `oxc.enable`[boolean]: Enable oxc language server(default: `true`).
* `oxc.configPath`[string]: Path to ESlint configuration.(default: `.eslintrc`).
* `oxc.binPath`[string]: Path to the `oxc_language_server` binary(default: `searches in the workspace for a viable binary`).

## Commands

* `oxc.restartServer`: Restart Oxc Server.
* `oxc.showOutputChannel`: Show Output Channel.
* `oxc.showTraceOutputChannel`: Show Trace Output Channel.

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
