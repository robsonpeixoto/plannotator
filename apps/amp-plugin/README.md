# Plannotator for Amp

This is a native Amp plugin for the manual Plannotator workflows:

- `Plannotator: Review changes`
- `Plannotator: Review changes or PR` (leave blank for local changes)
- `Plannotator: Annotate file`
- `Plannotator: Annotate last answer`

Amp commands live in the command palette, not as slash commands. This plugin does
not intercept Amp's planning flow.

## Install

Install the bundled (self-contained) plugin file:

```bash
mkdir -p ~/.config/amp/plugins
curl -fsSL https://raw.githubusercontent.com/backnotprop/plannotator/main/apps/amp-plugin/dist/plannotator.ts \
  -o ~/.config/amp/plugins/plannotator.ts
```

Restart Amp or run `plugins: reload` from the command palette.

For project-local installation, copy the bundled file to:

```text
.amp/plugins/plannotator.ts
```

The plugin auto-installs the `plannotator` CLI on first use if it isn't already
on your system. To install it ahead of time:

```bash
curl -fsSL https://plannotator.ai/install.sh | bash
```

## How it works

The plugin is a thin wrapper. Each command shells out to the `plannotator`
binary over the JSON plugin protocol (`plannotator plugin review|annotate`,
`--origin amp`) via the shared client in `@plannotator/shared/plugin-client` —
the same path OpenCode and Pi use. The binary starts (or reuses) the local
daemon, opens the browser itself, and reports the session URL back over the
protocol. When the user sends feedback, the plugin appends it to the active Amp
thread. The plugin never spawns a server, waits on a ready file, or scrapes
stderr for URLs.

## Local Development

From a Plannotator checkout, symlink the source file into your project and run
`plugins: reload` in Amp:

```bash
mkdir -p .amp/plugins
ln -sf ../../apps/amp-plugin/plannotator.ts .amp/plugins/plannotator.ts
export PLANNOTATOR_CWD="$PWD"
```

When loaded from inside the repo, the plugin auto-discovers the checkout's source
entrypoint (`findPlannotatorSourceRoot`) and runs it through Bun, so you don't
need a compiled binary on PATH. To point at a specific binary instead, set
`PLANNOTATOR_BIN`:

```bash
export PLANNOTATOR_BIN=/path/to/plannotator
```

### Distribution build

The published plugin is a single self-contained file. Bundle it (inlining the
shared client) with:

```bash
bun run build:amp   # writes apps/amp-plugin/dist/plannotator.ts
```

The raw `apps/amp-plugin/plannotator.ts` imports `@plannotator/shared` and only
resolves inside a repo checkout; ship `dist/plannotator.ts` for standalone use.
