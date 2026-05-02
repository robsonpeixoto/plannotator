<p align="center">
  <img src="apps/marketing/public/plannotator.webp" alt="Plannotator" width="200" />
</p>

<h1 align="center">Plannotator</h1>

<p align="center">
  Plan and code review for AI coding agents.
  <br />
  <a href="https://plannotator.ai">Website</a> &middot; <a href="https://plannotator.ai/docs">Docs</a> &middot; <a href="https://www.youtube.com/watch?v=a_AT7cEN_9I">Demo</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/backnotprop/plannotator?style=flat&logo=github&label=stars&color=gray" alt="GitHub stars" />
  <img src="https://img.shields.io/github/license/backnotprop/plannotator?color=gray" alt="License" />
</p>

---

## The problem

You tell your coding agent to refactor the auth module. It proposes a plan. You're staring at a wall of markdown in a terminal, trying to decide if this is reasonable. You squint. You scroll. You think "yeah, probably fine" and hit approve.

Three minutes later it's rewriting files you didn't expect it to touch.

The approval step is the most important moment in agentic coding -- the point where you shape what gets built -- and it happens in the worst possible interface. A terminal prompt. Yes or no. No way to mark up what you'd change, no way to say "this part is good but that part needs work." You either accept the whole thing or reject it and retype your objections from memory.

Same story for code review. The agent writes 400 lines across six files. You're supposed to review that... where? `git diff` in a terminal? Copy it into a PR you'll close five minutes later?

Plannotator fixes the surface. Not the agent, not the model, not the prompt -- the place where you actually look at the work and decide what happens next.

---

## What it does

Your agent proposes a plan. Plannotator intercepts the approval step and opens a real review workspace in your browser. Select text. Add comments. Mark deletions. Write replacements. When you deny, your annotations go back to the agent as structured feedback it can act on. When you approve, the plan executes. Either way, you're working with the output the way you'd work with a document from a colleague -- not a terminal prompt.

<p align="center">
  <img src="apps/marketing/public/assets/plan-review.webp" alt="Plan review UI showing inline annotations on an agent's proposed plan" width="90%" />
</p>

Code review works the same way. Run `/plannotator-review` and get a PR-style diff viewer over your agent's uncommitted changes -- file tree, side-by-side diffs, line-level annotations, stage/unstage. The workflow you already use for human PRs, applied to agent output.

<p align="center">
  <a href="https://www.youtube.com/watch?v=a_AT7cEN_9I">
    <img src="readme-assets/code-review-thumbnail.png" alt="Code review UI with file tree and side-by-side diff" width="90%" />
  </a>
</p>

| Mode | How it starts | What you get |
|---|---|---|
| **Plan Review** | Automatic -- hooks into agent plan approval | Annotate, comment, delete, approve/deny with structured feedback |
| **Plan Diff** | Automatic -- when agent revises a denied plan | Side-by-side diff showing what changed between versions |
| **Code Review** | `/plannotator-review` | PR-style diff viewer for local changes or GitHub/GitLab PRs |
| **Annotate** | `/plannotator-annotate <file\|folder\|url>` | Mark up any markdown, HTML, URL, or folder |
| **Annotate Last** | `/plannotator-last` | Annotate the agent's most recent response |

**Works with:** Claude Code, Copilot CLI, Gemini CLI, OpenCode, Pi, Codex, VS Code

**Runs locally.** Plans never leave your machine. Free and open source.

---

## See it in action

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://www.youtube.com/watch?v=a_AT7cEN_9I">
        <img src="apps/marketing/public/youtube.png" alt="Claude Code demo" width="100%" />
      </a>
      <br />
      <sub>Claude Code demo</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://youtu.be/_N7uo0EFI-U">
        <img src="apps/marketing/public/youtube-opencode.png" alt="OpenCode demo" width="100%" />
      </a>
      <br />
      <sub>OpenCode demo</sub>
    </td>
  </tr>
</table>

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

Every released binary ships with a SHA256 sidecar. [SLSA provenance](https://slsa.dev/) attestations are available from v0.17.2 -- see the [installation docs](https://plannotator.ai/docs/getting-started/installation/#verifying-your-install) for verification steps.

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

Restart after install. Plan review activates automatically when you use plan mode (`Shift+Tab`).

---

### Gemini CLI

```bash
curl -fsSL https://plannotator.ai/install.sh | bash
```

The installer auto-detects Gemini CLI (checks for `~/.gemini`) and configures the plan review hook, policy, and slash commands.

```
/plan                              # Enter plan mode -- plans open in your browser
/plannotator-review                # Code review for current changes
/plannotator-review <pr-url>       # Review a GitHub pull request
/plannotator-annotate <file.md>    # Annotate a markdown file
```

Requires Gemini CLI 0.36.0 or later. See [apps/gemini/README.md](apps/gemini/README.md) for details.

---

### OpenCode

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

---

### Pi

```bash
pi install npm:@plannotator/pi-extension
```

Start Pi with `--plan` to enter plan mode, or toggle with `/plannotator` during a session. See [apps/pi-extension/README.md](apps/pi-extension/README.md) for full usage.

---

### Codex

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

Note: plan mode is not yet supported for Codex.

---

## How it works

### Plan review

```
Agent calls ExitPlanMode
  -> Plannotator intercepts the approval step
  -> Browser opens with your review workspace
  -> You annotate: comment, delete, replace
  -> Approve  ->  agent proceeds with the plan
  -> Deny     ->  your annotations sent as structured feedback
  -> Agent revises  ->  plan diff shows what changed
```

You deny a plan. The agent revises. Plannotator shows you what changed -- added sections in green, removed in red, modified in yellow. You can annotate the diff itself, so your feedback references exactly what moved.

<p align="center">
  <img src="readme-assets/plan-diff.png" alt="Plan diff view showing changes between versions with keyboard shortcuts" width="90%" />
</p>

### Code review

```
You run /plannotator-review
  -> git diff captures changes (or PR fetched from URL)
  -> Browser opens with diff viewer
  -> You annotate lines, stage/unstage files
  -> Send feedback  ->  returned to agent session
  -> Approve  ->  "LGTM" sent
```

Pass a GitHub or GitLab PR URL to review remote pull requests with the same interface.

### Annotate mode

```
You run /plannotator-annotate <file.md | https://... | folder/>
  -> Content loaded and rendered
  -> You annotate inline
  -> Send  ->  feedback returned to agent
```

Works with markdown files, HTML (converted via Turndown), URLs (fetched via Jina Reader), and entire folders (file browser opens, files converted on demand).

<p align="center">
  <img src="readme-assets/annotate.png" alt="Annotate mode UI with TOC sidebar and inline annotations" width="90%" />
</p>

---

## Features

### Annotations

The annotation system is the core of everything. Select text and choose what to do with it:

- **Comment** -- add a note to any section
- **Delete** -- mark text for removal (redline mode auto-creates these on selection)
- **Replace** -- suggest alternative text
- **Global comment** -- leave feedback that applies to the whole document
- **Image attachments** -- attach screenshots or mockups to any annotation

### Plan diff and version history

Every plan is automatically saved to `~/.plannotator/history/`. When the agent revises a denied plan, the UI shows what changed. A `+N/-M` badge toggles between normal view and diff view with two modes:

- **Rendered diff** -- color-coded borders (green/red/yellow) on the formatted document
- **Raw diff** -- monospace `+/-` lines, git-style

You can select any prior version from the sidebar Version Browser and diff against it.

### Sharing

<p align="center">
  <img src="readme-assets/sharing.png" alt="Sharing portal with live review rooms" width="70%" />
</p>

Share plans and annotations with teammates. A colleague can annotate a shared plan and you can import their feedback to send back to the agent.

**Small plans** are encoded entirely in the URL hash. No server, nothing stored anywhere.

**Large plans** use a short-link service with **end-to-end encryption**. The plan is encrypted with AES-256-GCM in your browser before upload. The server stores only ciphertext it can never read. The decryption key lives only in the URL fragment you share. Pastes auto-delete after 7 days. Same model as [PrivateBin](https://privatebin.info/). The paste service is [self-hostable](https://plannotator.ai/docs/guides/sharing-and-collaboration/).

### Draft auto-save

Your annotations survive server crashes and restarts. Drafts are persisted to disk and restored automatically when the server comes back.

---

## Integrations

**VS Code** -- Open plans in editor tabs, view diffs inline, add annotations from the editor. Install the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=backnotprop.plannotator-webview).

**Obsidian** -- Auto-save approved plans to your vault with YAML frontmatter, tags extracted from the plan title, and a backlink for graph connectivity. Configure in Settings inside Plannotator.

**Bear** -- Save plans as Bear notes with nested tags and project metadata.

**GitHub / GitLab PRs** -- Pass any PR URL to `/plannotator-review` and review it with the full diff viewer.

---

## Remote / SSH / devcontainer

```bash
export PLANNOTATOR_REMOTE=1
export PLANNOTATOR_PORT=9999  # a port you'll forward
```

Plannotator uses a fixed port instead of a random one and prints the URL to the terminal. VS Code devcontainers forward the port automatically (check the Ports tab). For SSH, add to `~/.ssh/config`:

```
Host your-server
    LocalForward 9999 localhost:9999
```

---

## Environment variables

| Variable | Description |
|---|---|
| `PLANNOTATOR_REMOTE` | `1`/`true` for remote mode, `0`/`false` for local, or leave unset for SSH auto-detection |
| `PLANNOTATOR_PORT` | Fixed port. Default: random locally, `19432` for remote sessions |
| `PLANNOTATOR_BROWSER` | Custom browser to open plans in |
| `PLANNOTATOR_SHARE` | Set to `disabled` to turn off URL sharing entirely |
| `PLANNOTATOR_SHARE_URL` | Custom base URL for share links (self-hosted portal) |
| `PLANNOTATOR_PASTE_URL` | Base URL of the paste service API |
| `PLANNOTATOR_ORIGIN` | Override agent detection: `claude-code`, `opencode`, `codex`, `copilot-cli`, `gemini-cli` |
| `PLANNOTATOR_JINA` | `0`/`false` to disable Jina Reader for URL annotation. Default: enabled |
| `JINA_API_KEY` | Optional Jina Reader API key for higher rate limits |

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

**Build:**

```bash
bun run build          # Main targets (hook + opencode)
bun run build:hook     # Single-file HTML for the hook server
bun run build:review   # Code review editor
bun run build:opencode # OpenCode plugin
bun run build:vscode   # VS Code extension
```

Build order matters: `build:hook` copies pre-built HTML from `apps/review/dist/`. If you change UI code in `packages/ui/`, `packages/editor/`, or `packages/review-editor/`, rebuild the review app first:

```bash
bun run --cwd apps/review build && bun run build:hook
```

**Test locally with a compiled binary:**

```bash
bun run --cwd apps/review build && bun run build:hook && \
  bun build apps/hook/server/index.ts --compile --outfile ~/.local/bin/plannotator
```

**Test the plugin locally:**

```bash
claude --plugin-dir ./apps/hook
```

---

## License

Copyright 2025-2026 backnotprop

Dual-licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT) at your option.

Contributions are dual-licensed under the same terms unless you explicitly state otherwise.
