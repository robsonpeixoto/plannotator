<p align="center">
  <img src="apps/marketing/public/plannotator.webp" alt="Plannotator mascot" width="180" />
</p>

<h1 align="center">Plannotator</h1>

<p align="center">
  <strong>Plan and code review for AI coding agents</strong><br/>
  <sub>Annotate plans before execution. Review diffs before commit. Send structured feedback back to the agent.</sub>
</p>

<p align="center">
  <a href="https://github.com/backnotprop/plannotator/releases"><img src="https://img.shields.io/github/v/release/backnotprop/plannotator?style=flat-square&color=blue" alt="Release" /></a>&nbsp;
  <a href="https://github.com/backnotprop/plannotator/stargazers"><img src="https://img.shields.io/github/stars/backnotprop/plannotator?style=flat-square&color=yellow" alt="Stars" /></a>&nbsp;
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT%20%2F%20Apache--2.0-green?style=flat-square" alt="License" /></a>&nbsp;
  <a href="https://plannotator.ai"><img src="https://img.shields.io/badge/docs-plannotator.ai-purple?style=flat-square" alt="Docs" /></a>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=a_AT7cEN_9I">Watch the demo</a> · <a href="https://plannotator.ai/docs/getting-started/installation/">Installation guide</a> · <a href="https://plannotator.ai/docs/">Full docs</a>
</p>

---

Your AI agent proposes a plan. Today you squint at it in a terminal and type "y." Plannotator intercepts that approval step and opens a real review workspace in your browser — inline annotations, deletions, replacements, image attachments. Your feedback goes back to the agent as structured input it can act on.

Same idea for code: run `/plannotator-review` and get a PR-style diff viewer over your agent's uncommitted changes. Line-level annotations, file tree, stage/unstage — the full workflow, applied to agent output.

**Runs entirely locally. Plans never leave your machine. Free and open source.**

<br/>

<table>
<tr>
<td width="50%">

<a href="https://www.youtube.com/watch?v=a_AT7cEN_9I">
<img src="apps/marketing/public/youtube.png" alt="Claude Code demo — click to watch" width="100%"/>
</a>

<p align="center"><sub>Claude Code demo</sub></p>

</td>
<td width="50%">

<a href="https://youtu.be/_N7uo0EFI-U">
<img src="apps/marketing/public/youtube-opencode.png" alt="OpenCode demo — click to watch" width="100%"/>
</a>

<p align="center"><sub>OpenCode demo</sub></p>

</td>
</tr>
</table>

---

## What it does

| | Command | What happens |
|:---|:---|:---|
| **Plan Review** | _automatic_ | Intercepts agent plan approval — annotate inline before execution |
| **Plan Diff** | _automatic_ | Shows what changed when the agent revises a denied plan |
| **Code Review** | `/plannotator-review` | PR-style diff viewer for local changes or GitHub/GitLab PRs |
| **Annotate** | `/plannotator-annotate <file\|folder\|url>` | Annotate markdown, HTML, URLs, or entire folders |
| **Annotate Last** | `/plannotator-last` | Annotate the agent's most recent response |

> **Works with:** Claude Code &middot; Copilot CLI &middot; Gemini CLI &middot; OpenCode &middot; Pi &middot; Codex &middot; VS Code

---

## Install

Pick your agent. Each section is self-contained — expand the one you use.

<details open>
<summary><h3>Claude Code</h3></summary>

**1. Install the binary**

```bash
# macOS / Linux / WSL
curl -fsSL https://plannotator.ai/install.sh | bash

# Windows PowerShell
irm https://plannotator.ai/install.ps1 | iex
```

**2. Install the plugin**

```
/plugin marketplace add backnotprop/plannotator
/plugin install plannotator@plannotator
```

Restart Claude Code after the plugin install for hooks to activate.

<details>
<summary>Manual hook setup (no plugin system)</summary>

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "plannotator",
            "timeout": 345600
          }
        ]
      }
    ]
  }
}
```

</details>

<details>
<summary>Pin a specific version or verify provenance</summary>

```bash
curl -fsSL https://plannotator.ai/install.sh | bash -s -- --version vX.Y.Z
```

```powershell
& ([scriptblock]::Create((irm https://plannotator.ai/install.ps1))) -Version vX.Y.Z
```

Every released binary ships with a SHA256 sidecar. [SLSA provenance](https://slsa.dev/) attestations are available from v0.17.2 — see the [installation docs](https://plannotator.ai/docs/getting-started/installation/#verifying-your-install) for verification steps.

</details>

</details>

<details>
<summary><h3>Copilot CLI</h3></summary>

```bash
curl -fsSL https://plannotator.ai/install.sh | bash
```

Then in Copilot CLI:

```
/plugin marketplace add backnotprop/plannotator
/plugin install plannotator-copilot@plannotator
```

Restart after install. Plan review activates automatically when you use plan mode (`Shift+Tab`).

</details>

<details>
<summary><h3>Gemini CLI</h3></summary>

```bash
curl -fsSL https://plannotator.ai/install.sh | bash
```

The installer auto-detects Gemini CLI (checks for `~/.gemini`) and configures the plan review hook, policy, and slash commands.

```
/plan                              # Enter plan mode — plans open in your browser
/plannotator-review                # Code review for current changes
/plannotator-review <pr-url>       # Review a GitHub pull request
/plannotator-annotate <file.md>    # Annotate a markdown file
```

Requires Gemini CLI 0.36.0 or later. See [apps/gemini/README.md](apps/gemini/README.md) for details.

</details>

<details>
<summary><h3>OpenCode</h3></summary>

Add to `opencode.json`:

```json
{
  "plugin": ["@plannotator/opencode@latest"]
}
```

Then run the install script to get `/plannotator-review` and clear any cached plugin versions:

```bash
curl -fsSL https://plannotator.ai/install.sh | bash
```

Restart OpenCode.

</details>

<details>
<summary><h3>Pi</h3></summary>

```bash
pi install npm:@plannotator/pi-extension
```

Start Pi with `--plan` to enter plan mode, or toggle with `/plannotator` during a session. See [apps/pi-extension/README.md](apps/pi-extension/README.md) for full usage.

</details>

<details>
<summary><h3>Codex</h3></summary>

```bash
curl -fsSL https://plannotator.ai/install.sh | bash
```

Feedback flows back into the agent loop automatically:

```
!plannotator review           # Code review for current changes
!plannotator review <pr-url>  # Review a GitHub pull request
!plannotator annotate file.md # Annotate a markdown file
!plannotator last             # Annotate the last agent message
```

> **Note:** Plan mode is not yet supported for Codex.

</details>

---

## Features in depth

### Plan Review

<img src="apps/marketing/public/assets/plan-review.webp" alt="Plan review UI with inline annotations" width="100%"/>

Your agent proposes a plan. Plannotator intercepts the approval step and opens a review workspace in your browser.

- **Select text** to add inline comments, mark deletions, or write replacements
- **Redline mode** for quick deletion markup — select and it is struck through immediately
- **Image attachments** — drag screenshots or mockups into any annotation
- **Approve** and the agent proceeds. **Deny** and your annotations are exported as structured feedback the agent can parse and act on

```
Agent calls ExitPlanMode → hook fires → browser opens → you review → feedback returns to agent
```

### Plan Diff

<img src="readme-assets/plan-diff.png" alt="Plan diff view showing changes between plan versions" width="100%"/>

When you deny a plan and the agent resubmits, the UI shows exactly what changed. A `+N/-M` badge appears; click it to toggle between normal view and diff view.

- **Rendered diff** — color-coded left borders: green (added), red (removed), yellow (modified)
- **Raw diff** — monospace `+/-` lines, git-style
- **Diff annotations** — annotate added, removed, or modified blocks directly in the diff view
- **Version browser** — compare against any prior version from the sidebar

Every plan is automatically saved to `~/.plannotator/history/` with sequential versioning, deduplicated by content.

### Code Review

<a href="https://www.youtube.com/watch?v=a_AT7cEN_9I">
<img src="readme-assets/code-review-thumbnail.png" alt="Code review UI with file tree and side-by-side diff" width="100%"/>
</a>

Run `/plannotator-review` for a PR-style diff viewer over your agent's uncommitted changes — or pass a GitHub/GitLab PR URL to review remote pull requests.

- **Side-by-side or unified** diff view with syntax highlighting
- **File tree** navigation with change counts
- **Line-level annotations** — comment on specific lines or ranges
- **Stage / unstage** files directly from the review UI
- **AI assistant** — ask questions about the diff in context
- **Expandable context** — click to reveal surrounding lines beyond the default hunk

### Annotate

<img src="readme-assets/annotate.png" alt="Annotate mode with TOC sidebar and inline annotations" width="100%"/>

Annotate anything and send structured feedback back to the agent.

```bash
/plannotator-annotate README.md         # A local markdown file
/plannotator-annotate src/              # Browse and annotate files in a folder
/plannotator-annotate https://docs.rs/  # Fetch a URL (via Jina Reader) and annotate it
/plannotator-last                       # Annotate the agent's last response
```

Supports `.md`, `.mdx`, `.html`, `.htm`, and URLs. Folders open a file browser. HTML is converted to markdown via Turndown. URLs are fetched via [Jina Reader](https://jina.ai/reader/) by default (disable with `--no-jina`).

### Sharing

<img src="readme-assets/sharing.png" alt="Sharing portal with live review rooms" width="100%"/>

Share plans and annotations with teammates. A colleague can annotate a shared plan and you can import their feedback to send back to the agent.

| Plan size | How it works |
|:---|:---|
| **Small** | Entire plan + annotations encoded in the URL hash. No server, no storage, nothing leaves the link itself. |
| **Large** | End-to-end encrypted via AES-256-GCM in your browser. The paste server stores only ciphertext it cannot read. The decryption key lives only in the URL fragment. Auto-deletes after 7 days. |

Same model as [PrivateBin](https://privatebin.info/). The paste service is fully open source and [self-hostable](https://plannotator.ai/docs/guides/sharing-and-collaboration/).

---

## Integrations

<table>
<tr>
<td width="25%" align="center"><strong>VS Code</strong></td>
<td width="25%" align="center"><strong>Obsidian</strong></td>
<td width="25%" align="center"><strong>Bear</strong></td>
<td width="25%" align="center"><strong>GitHub / GitLab</strong></td>
</tr>
<tr>
<td>Open plans in editor tabs, view diffs inline, add annotations from the editor gutter</td>
<td>Auto-save approved plans to your vault with YAML frontmatter, tags, and graph backlinks</td>
<td>Save plans as Bear notes with nested tags and project metadata</td>
<td>Pass any PR URL to <code>/plannotator-review</code> for full diff annotations</td>
</tr>
<tr>
<td><a href="https://marketplace.visualstudio.com/items?itemName=backnotprop.plannotator-webview">Install extension</a></td>
<td>Configure in Settings</td>
<td>Configure in Settings</td>
<td>Built-in</td>
</tr>
</table>

---

## Remote / SSH / Devcontainer

Plannotator works in remote environments. Set a fixed port instead of a random one, then forward it to your local machine.

```bash
export PLANNOTATOR_REMOTE=1
export PLANNOTATOR_PORT=9999  # a port you'll forward
```

VS Code devcontainers forward the port automatically (check the Ports tab). For raw SSH, add to `~/.ssh/config`:

```
Host your-server
    LocalForward 9999 localhost:9999
```

> Without `PLANNOTATOR_REMOTE`, the tool auto-detects SSH sessions via `SSH_TTY` / `SSH_CONNECTION`.

---

## How it works

<details>
<summary><strong>Plan review flow</strong></summary>

```
Agent calls ExitPlanMode
  → PermissionRequest hook fires
  → Bun server reads plan from hook input (stdin JSON)
  → Server starts on random port, opens browser
  → You review the plan, add annotations
  → Approve  →  agent proceeds with execution
  → Deny     →  annotations exported as structured feedback → agent revises
  → Agent resubmits → plan diff shows what changed
```

</details>

<details>
<summary><strong>Code review flow</strong></summary>

```
You run /plannotator-review
  → git diff captures changes (or PR fetched by URL)
  → Browser opens with diff viewer
  → You annotate lines, stage/unstage files, ask AI questions
  → Send feedback → returned to agent session
  → Approve → "LGTM" sent to agent
```

</details>

<details>
<summary><strong>Annotate flow</strong></summary>

```
You run /plannotator-annotate <file.md | file.html | https://... | folder/>
  → Input type detected:
      .md/.mdx   → file read from disk
      .html/.htm → converted to markdown via Turndown
      https://   → fetched via Jina Reader (or fetch+Turndown with --no-jina)
      folder/    → file browser opens, files converted on demand
  → Browser opens with annotation UI
  → You annotate, then send feedback → returned to agent session
```

</details>

---

## Environment variables

| Variable | Default | Description |
|:---|:---|:---|
| `PLANNOTATOR_REMOTE` | _auto-detect_ | `1`/`true` for remote mode, `0`/`false` for local |
| `PLANNOTATOR_PORT` | random / `19432` | Fixed port for the review server |
| `PLANNOTATOR_BROWSER` | system default | Custom browser to open plans in |
| `PLANNOTATOR_SHARE` | enabled | Set to `disabled` to turn off URL sharing |
| `PLANNOTATOR_SHARE_URL` | `share.plannotator.ai` | Custom base URL for self-hosted share portal |
| `PLANNOTATOR_PASTE_URL` | hosted worker | Base URL of the paste service API |
| `PLANNOTATOR_ORIGIN` | _auto-detect_ | Override agent detection: `claude-code`, `opencode`, `codex`, `copilot-cli`, `gemini-cli` |
| `PLANNOTATOR_JINA` | enabled | `0`/`false` to disable Jina Reader for URL annotation |
| `JINA_API_KEY` | — | Optional Jina Reader API key for higher rate limits |

Settings can also be set persistently in `~/.plannotator/config.json`.

---

## Development

```bash
bun install

bun run dev:hook       # Hook server (plan review)
bun run dev:review     # Review editor (code review)
bun run dev:marketing  # Marketing site
bun run dev:vscode     # VS Code extension (watch mode)
```

### Build

```bash
bun run build          # Main targets (hook + opencode)
bun run build:hook     # Single-file HTML for the hook server
bun run build:review   # Code review editor
bun run build:opencode # OpenCode plugin
bun run build:vscode   # VS Code extension
```

> **Build order matters.** `build:hook` copies pre-built HTML from `apps/review/dist/`. If you change review UI code, rebuild review first:
>
> ```bash
> bun run --cwd apps/review build && bun run build:hook
> ```

### Test locally

```bash
# Run with the plugin directory
claude --plugin-dir ./apps/hook

# Or compile a binary
bun run --cwd apps/review build && bun run build:hook && \
  bun build apps/hook/server/index.ts --compile --outfile ~/.local/bin/plannotator
```

### Project structure

```
plannotator/
├── apps/
│   ├── hook/                  # Claude Code plugin (entry point, hooks, slash commands)
│   ├── opencode-plugin/       # OpenCode plugin
│   ├── marketing/             # plannotator.ai (Astro 5, static)
│   ├── paste-service/         # Short URL paste service (Bun / Cloudflare Worker)
│   ├── review/                # Standalone review dev server
│   └── vscode-extension/      # VS Code extension
├── packages/
│   ├── server/                # Shared Bun server (plan, review, annotate endpoints)
│   ├── ui/                    # Shared React components, hooks, theme
│   ├── ai/                    # Provider-agnostic AI backbone
│   ├── shared/                # Cross-runtime types, storage, utilities
│   ├── editor/                # Plan review app
│   └── review-editor/         # Code review app
└── legacy/                    # Pre-monorepo reference code
```

---

## License

Copyright 2025-2026 [backnotprop](https://github.com/backnotprop)

Dual-licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT) at your option.

Contributions are dual-licensed under the same terms unless you explicitly state otherwise.

---

<p align="center">
  <a href="https://plannotator.ai">plannotator.ai</a> · <a href="https://plannotator.ai/docs/">docs</a> · <a href="https://github.com/backnotprop/plannotator/releases">releases</a>
</p>
