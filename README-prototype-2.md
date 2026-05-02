<p align="center">
  <img src="apps/marketing/public/og-image.webp" alt="Plannotator" width="720" />
</p>

<h3 align="center">Plan and code review for AI coding agents.</h3>

<p align="center">
  <a href="https://plannotator.ai/docs/getting-started/installation/">Docs</a> &nbsp;&middot;&nbsp;
  <a href="https://www.youtube.com/watch?v=a_AT7cEN_9I">Demo</a> &nbsp;&middot;&nbsp;
  <a href="https://plannotator.ai">Website</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/backnotprop/plannotator?style=flat&logo=github&label=stars" alt="GitHub stars" />
  <img src="https://img.shields.io/github/license/backnotprop/plannotator" alt="License" />
</p>

---

Your agent proposes a plan. Instead of approving it in a terminal prompt, Plannotator opens a browser-based review workspace. Select text. Mark deletions. Add inline comments. Approve or deny. Your annotations are exported as structured feedback the agent actually understands.

Same idea for code: `/plannotator-review` gives you a PR-style diff viewer over your agent's uncommitted changes — or any GitHub/GitLab PR URL. Line-level annotations, file tree, stage/unstage.

Everything runs locally. Plans never leave your machine unless you explicitly share them. Free and open source.

**Works with:** Claude Code, Copilot CLI, Gemini CLI, OpenCode, Pi, Codex, VS Code

---

## What it does

| Feature | Trigger | What happens |
|---|---|---|
| **Plan review** | Automatic | Intercepts agent plan approval. Annotate before execution. |
| **Plan diff** | Automatic | When a plan is revised, shows exactly what changed. |
| **Code review** | `/plannotator-review` | PR-style diff viewer for local changes or remote PRs. |
| **Annotate files** | `/plannotator-annotate <path\|url>` | Annotate markdown, HTML, URLs, or entire folders. |
| **Annotate last** | `/plannotator-last` | Annotate the agent's most recent response. |

---

## Plan review

<p align="center">
  <img src="apps/marketing/public/assets/plan-review.webp" alt="Plan review UI — inline annotations on an agent's proposed implementation plan" width="720" />
</p>

The agent calls `ExitPlanMode`. A hook fires, reads the plan, starts a local server, and opens your browser. You see rendered markdown with a full annotation toolkit:

- **Inline comments** on any text selection
- **Deletions** to mark sections for removal
- **Replacements** to suggest alternative wording
- **Image attachments** on any annotation

Approve and the agent proceeds. Deny and your annotations are sent back as structured feedback. The agent revises. Plan diff shows what changed.

<p align="center">
  <img src="readme-assets/plan-diff.png" alt="Plan diff view showing changes between revisions with keyboard shortcuts overlay" width="720" />
</p>

Version history is automatic. Every plan revision is saved to `~/.plannotator/history/` before you see it. Identical resubmissions are deduplicated. You can diff against any prior version from the sidebar.

---

## Code review

<p align="center">
  <a href="https://www.youtube.com/watch?v=a_AT7cEN_9I">
    <img src="readme-assets/code-review-thumbnail.png" alt="Code review UI with file tree and side-by-side diff" width="720" />
  </a>
</p>

```
/plannotator-review                    # Review uncommitted changes
/plannotator-review <github-pr-url>    # Review a GitHub pull request
/plannotator-review <gitlab-mr-url>    # Review a GitLab merge request
```

Side-by-side or unified diff. File tree navigation. Expandable context. Stage or unstage files directly. Line-level annotations with code suggestions. Feedback goes straight back to the agent session.

Supports switching between staged, unstaged, and branch diffs. Whitespace toggle. Full keyboard navigation.

---

## Annotate mode

<p align="center">
  <img src="readme-assets/annotate.png" alt="Annotate mode — dark theme with TOC sidebar, inline annotations, and markup toolbar" width="720" />
</p>

```
/plannotator-annotate README.md          # Local markdown file
/plannotator-annotate src/               # Browse and annotate files in a folder
/plannotator-annotate https://docs.rs/…  # Fetch and annotate any URL
/plannotator-last                        # Annotate the agent's last message
```

Accepts `.md`, `.mdx`, `.html`, and URLs. URLs are fetched via Jina Reader by default (or raw fetch + Turndown with `--no-jina`). Folders open a file browser. Annotations are sent to the agent session as structured feedback.

---

## Sharing

<p align="center">
  <img src="readme-assets/sharing.png" alt="Sharing portal with upload options" width="720" />
</p>

**Small plans** are encoded entirely in the URL hash. No server involved — the data lives in the link itself.

**Large plans** use a short-link service with end-to-end encryption: AES-256-GCM in the browser before upload. The server stores only ciphertext. The decryption key lives exclusively in the URL fragment (never sent to the server). Pastes auto-delete after 7 days.

Same model as [PrivateBin](https://privatebin.info/). The paste service is [self-hostable](https://plannotator.ai/docs/guides/sharing-and-collaboration/).

Sharing can be disabled entirely with `PLANNOTATOR_SHARE=disabled`.

---

## Install

### Claude Code

```bash
# macOS / Linux / WSL
curl -fsSL https://plannotator.ai/install.sh | bash

# Windows PowerShell
irm https://plannotator.ai/install.ps1 | iex
```

Then in Claude Code:

```
/plugin marketplace add backnotprop/plannotator
/plugin install plannotator@plannotator
```

Restart Claude Code after install for hooks to activate.

<details>
<summary>Manual hook setup (without plugin system)</summary>

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
<summary>Pin a specific version</summary>

```bash
curl -fsSL https://plannotator.ai/install.sh | bash -s -- --version vX.Y.Z
```

```powershell
& ([scriptblock]::Create((irm https://plannotator.ai/install.ps1))) -Version vX.Y.Z
```

</details>

---

### Copilot CLI

```bash
curl -fsSL https://plannotator.ai/install.sh | bash
```

Then in Copilot CLI:

```
/plugin marketplace add backnotprop/plannotator
/plugin install plannotator-copilot@plannotator
```

Restart after install. Plan review activates automatically in plan mode (`Shift+Tab`).

---

### Gemini CLI

```bash
curl -fsSL https://plannotator.ai/install.sh | bash
```

The installer auto-detects Gemini CLI and configures the hook, policy, and slash commands.

```
/plan                              # Plans open in the browser
/plannotator-review                # Code review
/plannotator-review <pr-url>       # Review a GitHub pull request
/plannotator-annotate <file.md>    # Annotate a file
```

Requires Gemini CLI 0.36.0+. See [apps/gemini/README.md](apps/gemini/README.md).

---

### OpenCode

Add to `opencode.json`:

```json
{
  "plugin": ["@plannotator/opencode@latest"]
}
```

Then install the binary for `/plannotator-review`:

```bash
curl -fsSL https://plannotator.ai/install.sh | bash
```

Restart OpenCode.

---

### Pi

```bash
pi install npm:@plannotator/pi-extension
```

Start Pi with `--plan` for plan mode, or toggle with `/plannotator` during a session. See [apps/pi-extension/README.md](apps/pi-extension/README.md).

---

### Codex

```bash
curl -fsSL https://plannotator.ai/install.sh | bash
```

```
!plannotator review             # Code review
!plannotator review <pr-url>    # Review a PR
!plannotator annotate file.md   # Annotate a file
!plannotator last               # Annotate last message
```

Plan mode is not yet supported for Codex.

---

## How it works

### Plan review

```
Agent calls ExitPlanMode
  -> PermissionRequest hook fires
  -> Local server reads plan from hook input
  -> Browser opens with review UI
  -> You annotate and approve/deny
  -> Approve: agent proceeds
  -> Deny: structured feedback sent to agent
  -> Agent revises, plan diff shows what changed
```

### Code review

```
You run /plannotator-review
  -> git diff captures changes (or PR fetched by URL)
  -> Browser opens with diff viewer
  -> Annotate lines, stage/unstage files
  -> Send feedback: returned to agent session
  -> Approve: "LGTM" sent
```

---

## Demos

| Agent | Link |
|---|---|
| Claude Code | [youtube.com/watch?v=a_AT7cEN_9I](https://www.youtube.com/watch?v=a_AT7cEN_9I) |
| OpenCode | [youtu.be/_N7uo0EFI-U](https://youtu.be/_N7uo0EFI-U) |

---

## Integrations

**VS Code** — Open plans in editor tabs, view diffs inline, add annotations from the editor gutter. Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=backnotprop.plannotator-webview).

**Obsidian** — Auto-save approved plans to a vault with YAML frontmatter, tags from the plan title, and backlinks for graph connectivity. Configure in Plannotator's Settings panel.

**Bear** — Save plans as Bear notes with nested tags and project metadata.

**GitHub / GitLab** — Pass any PR or MR URL to `/plannotator-review` and review it with the full diff viewer, annotations, and file tree.

---

## Remote / SSH / devcontainer

Plannotator auto-detects SSH sessions and switches to a fixed port. For explicit control:

```bash
export PLANNOTATOR_REMOTE=1
export PLANNOTATOR_PORT=9999  # forward this port
```

VS Code devcontainers forward the port automatically (check the Ports tab). For raw SSH, add to `~/.ssh/config`:

```
Host your-server
    LocalForward 9999 localhost:9999
```

---

## Security

Every released binary ships with a SHA256 sidecar. [SLSA provenance](https://slsa.dev/) attestations are available from v0.17.2.

To verify on install:

```bash
curl -fsSL https://plannotator.ai/install.sh | bash -s -- --verify-attestation
```

Requires `gh` installed and authenticated. Can also be set persistently in `~/.plannotator/config.json`:

```json
{ "verifyAttestation": true }
```

See the [verification docs](https://plannotator.ai/docs/getting-started/installation/#verifying-your-install) for details.

---

## Configuration

Settings are persisted via cookies (not localStorage) because each hook invocation runs on a random port. You can also set options via environment variables or `~/.plannotator/config.json`.

| Variable | Description |
|---|---|
| `PLANNOTATOR_REMOTE` | `1`/`true` for remote mode, `0`/`false` for local, unset for SSH auto-detection |
| `PLANNOTATOR_PORT` | Fixed port (default: random locally, `19432` remote) |
| `PLANNOTATOR_BROWSER` | Custom browser to open plans in |
| `PLANNOTATOR_SHARE` | `disabled` to turn off URL sharing |
| `PLANNOTATOR_SHARE_URL` | Custom base URL for share links (self-hosted portal) |
| `PLANNOTATOR_PASTE_URL` | Base URL of the paste service API |
| `PLANNOTATOR_ORIGIN` | Override agent detection: `claude-code`, `opencode`, `codex`, `copilot-cli`, `gemini-cli` |
| `PLANNOTATOR_JINA` | `0`/`false` to disable Jina Reader for URL annotation |
| `JINA_API_KEY` | Jina Reader API key for higher rate limits |

---

## Development

```bash
bun install

bun run dev:hook       # Plan review server
bun run dev:review     # Code review editor
bun run dev:marketing  # Marketing site (plannotator.ai)
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

Build order matters. The hook build copies pre-built HTML from `apps/review/dist/`. If you change UI code in `packages/ui/`, `packages/editor/`, or `packages/review-editor/`, rebuild the review app first:

```bash
bun run --cwd apps/review build && bun run build:hook
```

Test the plugin locally:

```bash
claude --plugin-dir ./apps/hook
```

Full binary build:

```bash
bun run --cwd apps/review build && bun run build:hook && \
  bun build apps/hook/server/index.ts --compile --outfile ~/.local/bin/plannotator
```

### Project structure

```
plannotator/
├── apps/
│   ├── hook/                  # Claude Code plugin (entry point, hooks, commands)
│   ├── opencode-plugin/       # OpenCode plugin
│   ├── marketing/             # plannotator.ai (Astro 5, static)
│   ├── paste-service/         # E2E encrypted paste service (Cloudflare Worker)
│   ├── review/                # Standalone review dev server
│   └── vscode-extension/      # VS Code extension
├── packages/
│   ├── server/                # Shared Bun server (plan, review, annotate)
│   ├── ui/                    # React components, theme, annotation system
│   ├── ai/                    # Provider-agnostic AI backbone
│   ├── shared/                # Cross-runtime types, storage, utilities
│   ├── editor/                # Plan review app (App.tsx)
│   └── review-editor/         # Code review app (App.tsx, DiffViewer, FileTree)
```

---

## License

Copyright 2025-2026 backnotprop

Dual-licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT) at your option.

Contributions are dual-licensed under the same terms unless you explicitly state otherwise.
