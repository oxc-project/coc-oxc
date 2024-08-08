# coc-oxc

[Oxc](https://github.com/oxc-project/oxc) extension for coc.nvim

## Install

`:CocInstall coc-oxc`

## Configurations

* `oxc.run`: Run the linter on save `onSave` or on type `onType`(default: `onType`).
* `oxc.enable`: Enable oxc language server(default: `true`).
* `oxc.configPath`: Path to ESlint configuration.(default: `.eslintrc`).
* `oxc.binPath`: Path to the `oxc_language_server` binary(default: `searches in the workspace for a viable binary`).

## Commands

* `oxc.restartServer`: Restart Oxc Server.
* `oxc.showOutputChannel`: Show Output Channel.
* `oxc.showTraceOutputChannel`: Show Trace Output Channel.

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
