<p align="center">
  <a href="https://plannotator.ai">
    <img src="apps/marketing/public/plannotator.webp" alt="Plannotator" width="200" />
  </a>
</p>

<h3 align="center">Plan & code review for AI coding agents</h3>

<p align="center">
  <a href="https://plannotator.ai/docs/getting-started/installation/">Docs</a> &nbsp;·&nbsp;
  <a href="https://www.youtube.com/watch?v=a_AT7cEN_9I">Demo</a> &nbsp;·&nbsp;
  <a href="https://plannotator.ai">Website</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/backnotprop/plannotator?style=flat&logo=github&label=stars&color=gray" alt="GitHub stars" />
  <img src="https://img.shields.io/badge/license-MIT%2FApache--2.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/runs-locally-green" alt="Runs locally" />
</p>

---

Your agent proposes a plan. Instead of approving in the terminal, Plannotator opens a review workspace. Annotate inline. Mark deletions. Write replacements. Your feedback goes back to the agent as structured input. Same idea for code: get a PR-style diff viewer over uncommitted changes with line-level annotations.

Runs locally. Plans never leave your machine. Free and open source.

**Works with:** Claude Code · Copilot CLI · Gemini CLI · OpenCode · Pi · Codex

<br/>

<p align="center">
  <a href="https://www.youtube.com/watch?v=a_AT7cEN_9I">
    <img src="apps/marketing/public/youtube.png" alt="Watch the Claude Code demo" width="600" />
  </a>
</p>

---

## Install

```bash
# macOS / Linux / WSL
curl -fsSL https://plannotator.ai/install.sh | bash

# Windows PowerShell
irm https://plannotator.ai/install.ps1 | iex
```

Then activate the plugin for your agent:

| Agent | Setup |
|---|---|
| **Claude Code** | `/plugin marketplace add backnotprop/plannotator` then `/plugin install plannotator@plannotator` — restart after |
| **Copilot CLI** | `/plugin marketplace add backnotprop/plannotator` then `/plugin install plannotator-copilot@plannotator` — restart after |
| **Gemini CLI** | Installer auto-detects `~/.gemini` and configures hooks. Requires v0.36.0+ |
| **OpenCode** | Add `"plugin": ["@plannotator/opencode@latest"]` to `opencode.json` — restart after |
| **Pi** | `pi install npm:@plannotator/pi-extension` — start with `--plan` for plan mode |
| **Codex** | Install script is all you need. Use `!plannotator review`, `!plannotator annotate`, `!plannotator last` |

<details>
<summary>Pin a version or verify provenance</summary>

```bash
curl -fsSL https://plannotator.ai/install.sh | bash -s -- --version vX.Y.Z
```

Every binary ships with a SHA256 sidecar. [SLSA provenance](https://slsa.dev/) attestations available from v0.17.2 — see [verification docs](https://plannotator.ai/docs/getting-started/installation/#verifying-your-install).

</details>

---

## What you get

| Feature | Trigger | What it does |
|---|---|---|
| **Plan Review** | Automatic | Intercepts agent plan approval — annotate before execution |
| **Plan Diff** | Automatic | Shows what changed when the agent revises a denied plan |
| **Code Review** | `/plannotator-review` | PR-style diff viewer for local changes or GitHub/GitLab PRs |
| **Annotate** | `/plannotator-annotate <file\|folder\|url>` | Annotate markdown, HTML, URLs, or browse a folder |
| **Annotate Last** | `/plannotator-last` | Annotate the agent's most recent response |

<br/>

<p align="center">
  <img src="apps/marketing/public/assets/plan-review.webp" alt="Plan review UI — inline annotations on an agent's proposed plan" width="700" />
</p>
<p align="center"><em>Plan review — select text, add comments, mark deletions, approve or deny</em></p>

<br/>

<p align="center">
  <img src="readme-assets/code-review-thumbnail.png" alt="Code review UI — file tree with side-by-side diff" width="700" />
</p>
<p align="center"><em>Code review — file tree, side-by-side diff, line-level annotations</em></p>

---

## How it works

**Plan review** — zero config, it just intercepts:

```
Agent calls ExitPlanMode → hook fires → browser opens review UI
→ you annotate → approve (agent proceeds) or deny (feedback sent back)
→ agent revises → plan diff shows what changed
```

**Code review** — you trigger it:

```
/plannotator-review → git diff captured → browser opens diff viewer
→ annotate lines, stage/unstage files → send feedback or approve
```

---

## More

<p align="center">
  <img src="readme-assets/annotate.png" alt="Annotate mode — dark theme with TOC sidebar and inline annotations" width="700" />
</p>
<p align="center"><em>Annotate any markdown file, URL, or folder — TOC sidebar, inline annotations, markup toolbar</em></p>

<br/>

**Sharing** — Small plans encode entirely in the URL hash (no server). Large plans use E2E encryption (AES-256-GCM, key stays in the URL fragment, server sees only ciphertext). Self-hostable. Auto-deletes after 7 days.

**Version history** — Every plan revision saved to `~/.plannotator/history/`. Diff between any two versions.

**VS Code extension** — Open plans in editor tabs, view diffs inline, add annotations from the editor. [Install from marketplace](https://marketplace.visualstudio.com/items?itemName=backnotprop.plannotator-webview).

**Obsidian / Bear** — Auto-save approved plans to your vault or Bear with frontmatter, tags, and backlinks.

**Remote / SSH / Devcontainer** — Set `PLANNOTATOR_REMOTE=1` and `PLANNOTATOR_PORT=9999`, forward the port, done.

<details>
<summary>All environment variables</summary>

| Variable | Description |
|---|---|
| `PLANNOTATOR_REMOTE` | `1` for remote, `0` for local, unset for auto-detect |
| `PLANNOTATOR_PORT` | Fixed port (default: random locally, `19432` remote) |
| `PLANNOTATOR_BROWSER` | Custom browser app/path |
| `PLANNOTATOR_SHARE` | `disabled` to turn off sharing |
| `PLANNOTATOR_SHARE_URL` | Custom share portal URL |
| `PLANNOTATOR_PASTE_URL` | Custom paste service URL |
| `PLANNOTATOR_ORIGIN` | Override agent detection |
| `PLANNOTATOR_JINA` | `0` to disable Jina Reader for URL annotation |
| `JINA_API_KEY` | Jina API key for higher rate limits |

Persistent config: `~/.plannotator/config.json`

</details>

---

## Development

```bash
bun install
bun run dev:hook       # Plan review server
bun run dev:review     # Code review editor
bun run build          # Build main targets
```

Build order matters — review UI changes require `bun run --cwd apps/review build && bun run build:hook`.

Test locally: `claude --plugin-dir ./apps/hook`

---

## License

Copyright 2025-2026 backnotprop. Dual-licensed under [Apache 2.0](LICENSE-APACHE) or [MIT](LICENSE-MIT).
