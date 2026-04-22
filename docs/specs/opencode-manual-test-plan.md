# OpenCode Manual Test Plan

## Purpose

Validate the OpenCode changes on this branch end to end:

- workflow-gated `submit_plan` access
- prompt and tool-definition behavior across workflow modes
- manual command behavior, including folder annotation
- migration behavior for existing OpenCode users

This plan is for local testing. Do not publish the plugin to npm for these checks.

## Scope

In scope:

- `workflow: "plan-agent"` default behavior
- `workflow: "manual"` commands-only behavior
- `workflow: "all-agents"` legacy broad behavior
- plan-agent prompt injection and access control
- `submit_plan` runtime rejection for the wrong agent
- `/plannotator-annotate` support for files, folders, and URLs
- `/plannotator-last` basic behavior
- doc examples and migration snippets

Out of scope for this pass:

- deep browser UI QA inside the Plannotator app itself
- unrelated OpenCode plugin behavior
- approval-semantics redesign beyond current behavior

## Test Environment

Recommended environment:

- local checkout of this repo on the branch under test
- local OpenCode environment
- a throwaway test project for OpenCode sessions
- browser available locally

Use a local file/path plugin. npm publishing is not required.

Supported local setups:

1. Put the plugin in `.opencode/plugins/` inside the test project.
2. Point `opencode.json` at a relative or absolute local plugin path.

## Recommended Sandbox Runs

The local OpenCode sandbox can now exercise all three workflow modes.

From the repo root:

```bash
bash tests/manual/local/sandbox-opencode.sh --workflow plan-agent --keep
bash tests/manual/local/sandbox-opencode.sh --workflow manual --keep
bash tests/manual/local/sandbox-opencode.sh --workflow all-agents --keep
```

Optional custom planning agent run:

```bash
bash tests/manual/local/sandbox-opencode.sh --workflow plan-agent --planning-agents planner --keep
```

Use `--keep` while testing so the generated sandbox directory and `opencode.json`
remain available for inspection after OpenCode exits.

## Local Plugin Setup

### Option A: Auto-loaded project plugin

Create this structure in the project you will open with OpenCode:

```text
your-test-project/
  .opencode/
    package.json
    plugins/
      plannotator.ts
```

`.opencode/package.json`:

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "*"
  }
}
```

`plannotator.ts` can re-export the local plugin entry from this repo, or you can point straight at the repo file with Option B.

### Option B: Local path in `opencode.json`

Use the plugin tuple form so workflow options can be changed without editing code:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["/absolute/path/to/plannotator/apps/opencode-plugin/index.ts", {
      "workflow": "plan-agent",
      "planningAgents": ["plan"]
    }]
  ]
}
```

Use the same pattern for `manual` and `all-agents` test runs.

## Test Data

Prepare a small test workspace with:

- one markdown file such as `notes/plan.md`
- one HTML file such as `notes/spec.html`
- one folder containing markdown or HTML files such as `specs/`
- one folder with no markdown or HTML files for negative testing
- one simple coding task that naturally triggers OpenCode planning

## Test Matrix

| Area | `manual` | `plan-agent` | `all-agents` |
|---|---|---|---|
| `submit_plan` registered | No | Yes | Yes |
| `plan` can call `submit_plan` | No | Yes | Yes |
| `build` can call `submit_plan` | No | No | Yes |
| full planning prompt injected for `plan` | No | Yes | Yes |
| generic reminder injected for non-plan primary agents | No | No | Yes |
| `plan_exit` / `todowrite` rewrites active | No | Yes | Yes |
| `/plannotator-last` works | Yes | Yes | Yes |
| `/plannotator-annotate` works | Yes | Yes | Yes |

## Test Cases

### 1. Plugin Loads Locally

Setup:

- Start OpenCode in the test project with the local plugin configuration.

Verify:

- OpenCode starts successfully.
- The plugin loads without requiring an npm publish.
- Slash commands and tool behavior match the configured workflow.

Expected result:

- No startup failure caused by plugin resolution.

### 2. Default Workflow Is `plan-agent`

Setup:

- Omit plugin options and load the local plugin.

Verify:

- OpenCode behaves as if configured with:

```json
{
  "workflow": "plan-agent",
  "planningAgents": ["plan"]
}
```

Expected result:

- `submit_plan` is available to `plan`.
- `build` does not get broad access by default.

### 3. `manual` Mode Removes Automatic Planning Integration

Setup:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["/absolute/path/to/plannotator/apps/opencode-plugin/index.ts", {
      "workflow": "manual"
    }]
  ]
}
```

Steps:

1. Start a session and use OpenCode plan mode.
2. Inspect the available tools for `plan` and `build`.
3. Ask the agent for a plan.
4. Run `/plannotator-last`.
5. Run `/plannotator-annotate notes/plan.md`.

Verify:

- `submit_plan` is not registered.
- No Plannotator planning prompt is injected.
- `plan_exit` and `todowrite` descriptions are not rewritten.
- Manual commands still work.

Expected result:

- OpenCode planning remains native.
- Plannotator is only used when the user manually invokes it.

### 4. `plan-agent` Mode Scopes `submit_plan` To Planning Agents

Setup:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["/absolute/path/to/plannotator/apps/opencode-plugin/index.ts", {
      "workflow": "plan-agent",
      "planningAgents": ["plan"]
    }]
  ]
}
```

Steps:

1. Start a session with OpenCode plan mode.
2. Trigger planning with the `plan` agent.
3. Inspect the `plan` agent tool list.
4. Inspect the `build` agent tool list.
5. Ask `plan` to produce and submit a plan.

Verify:

- `plan` can see and call `submit_plan`.
- `build` cannot see or use `submit_plan` in the normal tool list.
- The full Plannotator planning prompt is injected for `plan`.
- The generic reminder is not injected into unrelated primary agents.
- `plan_exit` and `todowrite` rewrites still appear.

Expected result:

- OpenCode plan mode remains integrated with Plannotator.
- Broad primary-agent exposure is gone by default.

### 5. Runtime Guard Rejects Wrong-Agent Calls

Setup:

- Stay in `plan-agent` mode.

Steps:

1. Try to force a `submit_plan` call from `build` or another non-planning agent.
2. If direct invocation is possible through a prompt or tool replay path, execute it.

Verify:

- The call is rejected with a clear message.
- Plannotator does not open.
- The rejection points users toward `/plannotator-last`, `/plannotator-annotate`, or `workflow: "all-agents"`.

Expected result:

- Wrong-agent invocation fails safely even if visibility checks are bypassed.

### 6. Custom Planning Agent Works

Setup:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["/absolute/path/to/plannotator/apps/opencode-plugin/index.ts", {
      "workflow": "plan-agent",
      "planningAgents": ["planner"]
    }]
  ]
}
```

Steps:

1. Configure or use an OpenCode agent named `planner`.
2. Start a session that routes planning through `planner`.
3. Inspect `planner` and `build`.

Verify:

- `planner` gets `submit_plan`.
- `build` is denied.
- Planning prompt injection follows `planner`, not `plan`.

Expected result:

- Workflow gating tracks the configured planning-agent list.

### 7. `all-agents` Preserves Legacy Broad Behavior

Setup:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    ["/absolute/path/to/plannotator/apps/opencode-plugin/index.ts", {
      "workflow": "all-agents"
    }]
  ]
}
```

Steps:

1. Start a session.
2. Inspect `plan` and `build`.
3. Ask a non-plan primary agent to produce a plan.

Verify:

- `submit_plan` remains broadly available to primary agents.
- The generic plan reminder is still injected for non-plan primary agents.
- `plan_exit` and `todowrite` rewrites remain active.

Expected result:

- Existing users can opt back into the old model.

### 8. `/plannotator-annotate` Supports Markdown Files

Steps:

1. Run `/plannotator-annotate notes/plan.md`.

Verify:

- The annotation UI opens for the markdown file.
- File resolution works as expected.

Expected result:

- Existing annotate-file behavior still works.

### 9. `/plannotator-annotate` Supports HTML Files

Steps:

1. Run `/plannotator-annotate notes/spec.html`.

Verify:

- The file is converted and opened in the annotation UI.
- Oversized HTML files still fail with a useful error.

Expected result:

- HTML annotation remains intact.

### 10. `/plannotator-annotate` Supports Folders

Steps:

1. Run `/plannotator-annotate specs/`.
2. Repeat with `@specs/`.

Verify:

- The annotation UI opens in folder mode.
- The leading `@` prefix is tolerated.
- The folder path is passed through correctly.

Expected result:

- Folder annotation works through the OpenCode plugin command path.

### 11. `/plannotator-annotate` Rejects Invalid Folders

Steps:

1. Run `/plannotator-annotate empty-folder/` where the folder contains no markdown or HTML files.

Verify:

- The command fails with a clear error instead of opening the UI.

Expected result:

- Invalid folder input is rejected cleanly.

### 12. `/plannotator-annotate` Supports URLs

Steps:

1. Run `/plannotator-annotate https://example.com`.

Verify:

- The page is fetched and opened in the annotation UI.

Expected result:

- URL annotation still works after the command changes.

### 13. `/plannotator-last` Still Works In Every Workflow

Steps:

1. Have the agent produce a normal message.
2. Run `/plannotator-last`.

Verify:

- The last assistant message opens for annotation.
- Returned feedback is sent back into the session.

Expected result:

- Manual review of the latest assistant output remains available regardless of workflow mode.

### 14. Migration Docs Match Runtime Behavior

Files to spot-check:

- `apps/opencode-plugin/README.md`
- `apps/marketing/src/content/docs/guides/opencode.md`
- `apps/marketing/src/content/docs/getting-started/configuration.md`
- `apps/marketing/src/content/docs/getting-started/installation.md`
- `apps/marketing/src/content/docs/guides/troubleshooting.md`

Verify:

- Docs say the default is `plan-agent`.
- Docs show how to opt into `all-agents`.
- Docs show how to opt into `manual`.
- Docs say `/plannotator-annotate` supports folders.
- Troubleshooting explains why `build` cannot call `submit_plan` by default.

Expected result:

- Documentation matches actual plugin behavior.

## Regression Checks

Before signoff, confirm:

- `submit_plan` still opens the browser UI and completes a normal review cycle.
- approved plans still return success to the agent
- denied plans still return revision feedback
- plan-agent mode does not break OpenCode plan mode
- manual mode does not accidentally register `submit_plan`
- all-agents mode does not accidentally deny `build`

## Signoff Criteria

This change is ready if:

- all three workflow modes behave as documented
- default behavior is `plan-agent`
- non-planning agents no longer get eager `submit_plan` exposure by default
- manual commands remain strong first-class paths
- folder annotation works through the OpenCode plugin
- migration docs are accurate
