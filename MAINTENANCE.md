# Maintenance

## Local Development

1. Build the project:

```sh
pnpm build
```

2. Link to this repo in `~/.config/coc/extensions/package.json`:

```json
{
  "dependencies": {
    "coc-oxc": "link:/Users/boshen/oxc/coc-oxc"
  }
}
```

3. Restart neovim to load the extension.
