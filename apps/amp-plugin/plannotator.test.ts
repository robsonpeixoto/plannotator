import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildBaseRequest,
  buildEnv,
  extractTextFromThreadMessage,
  findFirstPositionalArg,
  formatAnnotationFeedback,
  getPlannotatorDataDir,
  handleAnnotateResult,
  handleReviewResult,
  isNoActionFeedback,
  parseReviewTargetInput,
  resolveAmpWorkspaceRoot,
  resolveCwd,
  runAnnotate,
  runAnnotateLast,
  runReview,
  splitCommandArgs,
  type BinaryClientDeps,
} from "./plannotator";
import { type EnsurePlannotatorBinaryResult } from "../../packages/shared/plugin-client";
import {
  createPluginErrorResponse,
  createPluginSuccessResponse,
  type PluginAnnotateResult,
  type PluginResponse,
  type PluginReviewResult,
} from "../../packages/shared/plugin-protocol";

describe("Amp Plannotator plugin helpers", () => {
  test("extracts visible assistant text blocks", () => {
    const text = extractTextFromThreadMessage({
      role: "assistant",
      id: "m-1",
      content: [
        { type: "thinking", thinking: "hidden reasoning" },
        { type: "text", text: "First paragraph." },
        { type: "tool_use", id: "tool-1", name: "bash", input: {} },
        { type: "text", text: "Second paragraph." },
      ],
    });

    expect(text).toBe("First paragraph.\n\nSecond paragraph.");
  });

  test("wraps actionable annotation feedback for Amp thread append", () => {
    expect(
      formatAnnotationFeedback(
        { decision: "annotated", feedback: "Comment: tighten this section." },
        { kind: "message" },
      ),
    ).toBe(
      "# Message Annotations\n\nComment: tighten this section.\n\nPlease address the annotation feedback above.",
    );
  });

  test("wraps file annotation feedback with target path", () => {
    expect(
      formatAnnotationFeedback(
        { decision: "annotated", feedback: "Comment: tighten this section." },
        { kind: "file", filePath: "docs/plan.md" },
      ),
    ).toBe(
      "# Markdown Annotations\n\nFile: docs/plan.md\n\nComment: tighten this section.\n\nPlease address the annotation feedback above.",
    );
  });

  test("detects non-action outputs", () => {
    expect(isNoActionFeedback("Review session closed without feedback.")).toBe(true);
    expect(isNoActionFeedback("Code review completed — no changes requested.")).toBe(false);
    expect(isNoActionFeedback("Please fix this bug.")).toBe(false);
  });

  test("splits review target arguments without invoking a shell", () => {
    expect(splitCommandArgs("--git https://github.com/org/repo/pull/1")).toEqual([
      "--git",
      "https://github.com/org/repo/pull/1",
    ]);
    expect(splitCommandArgs('"https://example.com/a path"')).toEqual([
      "https://example.com/a path",
    ]);
    expect(splitCommandArgs(String.raw`docs/My\ File.md --gate`)).toEqual([
      "docs/My File.md",
      "--gate",
    ]);
    expect(splitCommandArgs(String.raw`C:\Users\alice\plan.md`)).toEqual([
      String.raw`C:\Users\alice\plan.md`,
    ]);
    expect(splitCommandArgs(String.raw`"C:\Users\alice\My Plan.md"`)).toEqual([
      String.raw`C:\Users\alice\My Plan.md`,
    ]);
  });

  test("finds annotate target after flags", () => {
    expect(findFirstPositionalArg(["--no-jina", "https://example.com"])).toBe("https://example.com");
    expect(findFirstPositionalArg(["--browser", "Google Chrome", "docs/plan.md"])).toBe("docs/plan.md");
  });

  test("distinguishes canceled review target prompts from blank local reviews", () => {
    expect(parseReviewTargetInput(undefined)).toBeNull();
    expect(parseReviewTargetInput("   ")).toEqual([]);
    expect(parseReviewTargetInput("--git https://github.com/org/repo/pull/1")).toEqual([
      "--git",
      "https://github.com/org/repo/pull/1",
    ]);
  });

  test("prefers Amp command cwd over process PWD", async () => {
    const processPwd = mkdtempSync(join(tmpdir(), "plannotator-amp-process-"));
    const commandCwd = mkdtempSync(join(tmpdir(), "plannotator-amp-command-"));
    const originalPwd = process.env.PWD;
    const originalOverride = process.env.PLANNOTATOR_CWD;
    const originalLogFile = process.env.AMP_LOG_FILE;

    try {
      process.env.PWD = processPwd;
      delete process.env.PLANNOTATOR_CWD;
      process.env.AMP_LOG_FILE = join(processPwd, "missing-amp.log");

      const cwd = await resolveCwd(commandContextWithCwd(commandCwd));

      expect(cwd).toBe(commandCwd);
    } finally {
      restoreEnv("PWD", originalPwd);
      restoreEnv("PLANNOTATOR_CWD", originalOverride);
      restoreEnv("AMP_LOG_FILE", originalLogFile);
      rmSync(processPwd, { recursive: true, force: true });
      rmSync(commandCwd, { recursive: true, force: true });
    }
  });

  test("resolves Amp workspace root from the parent CLI log", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "plannotator-amp-log-"));
    const oldWorkspace = mkdtempSync(join(tempDir, "old-workspace-"));
    const currentWorkspace = mkdtempSync(join(tempDir, "current-workspace-"));
    const logPath = join(tempDir, "cli.log");

    try {
      writeFileSync(
        logPath,
        [
          JSON.stringify({
            pid: 123,
            workspaceRoot: pathToFileURL(oldWorkspace).href,
          }),
          JSON.stringify({
            pid: 456,
            workspaceRoot: pathToFileURL(currentWorkspace).href,
          }),
        ].join("\n"),
        "utf8",
      );

      expect(resolveAmpWorkspaceRoot({ logPath, parentPid: 456 })).toBe(currentWorkspace);
      expect(resolveAmpWorkspaceRoot({ logPath, parentPid: 999 })).toBe(currentWorkspace);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("uses Amp workspace log before plugin runtime cwd", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "plannotator-amp-cwd-"));
    const workspace = mkdtempSync(join(tempDir, "workspace-"));
    const pluginCwd = mkdtempSync(join(tempDir, "plugins-"));
    const logPath = join(tempDir, "cli.log");
    const originalLogFile = process.env.AMP_LOG_FILE;
    const originalOverride = process.env.PLANNOTATOR_CWD;

    try {
      process.env.AMP_LOG_FILE = logPath;
      delete process.env.PLANNOTATOR_CWD;
      writeFileSync(
        logPath,
        JSON.stringify({
          pid: process.ppid,
          workspaceRoot: pathToFileURL(workspace).href,
        }),
        "utf8",
      );

      const cwd = await resolveCwd(commandContextWithCwd(pluginCwd));

      expect(cwd).toBe(workspace);
    } finally {
      restoreEnv("AMP_LOG_FILE", originalLogFile);
      restoreEnv("PLANNOTATOR_CWD", originalOverride);
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("lets PLANNOTATOR_CWD override Amp command cwd", async () => {
    const explicitCwd = mkdtempSync(join(tmpdir(), "plannotator-amp-explicit-"));
    const commandCwd = mkdtempSync(join(tmpdir(), "plannotator-amp-command-"));
    const originalOverride = process.env.PLANNOTATOR_CWD;

    try {
      process.env.PLANNOTATOR_CWD = explicitCwd;

      const cwd = await resolveCwd(commandContextWithCwd(commandCwd));

      expect(cwd).toBe(explicitCwd);
    } finally {
      restoreEnv("PLANNOTATOR_CWD", originalOverride);
      rmSync(explicitCwd, { recursive: true, force: true });
      rmSync(commandCwd, { recursive: true, force: true });
    }
  });

  test("populates the shared base request with amp origin and sharing fields", () => {
    const originalShare = process.env.PLANNOTATOR_SHARE;
    const originalShareUrl = process.env.PLANNOTATOR_SHARE_URL;
    const originalPasteUrl = process.env.PLANNOTATOR_PASTE_URL;

    try {
      delete process.env.PLANNOTATOR_SHARE;
      process.env.PLANNOTATOR_SHARE_URL = "https://share.example.com";
      process.env.PLANNOTATOR_PASTE_URL = "https://paste.example.com";

      expect(buildBaseRequest("/repo")).toEqual({
        origin: "amp",
        cwd: "/repo",
        sharingEnabled: true,
        shareBaseUrl: "https://share.example.com",
        pasteApiUrl: "https://paste.example.com",
      });

      process.env.PLANNOTATOR_SHARE = "disabled";
      expect(buildBaseRequest("/repo").sharingEnabled).toBe(false);
    } finally {
      restoreEnv("PLANNOTATOR_SHARE", originalShare);
      restoreEnv("PLANNOTATOR_SHARE_URL", originalShareUrl);
      restoreEnv("PLANNOTATOR_PASTE_URL", originalPasteUrl);
    }
  });

  test("does not let Amp's Bun mode leak into the Plannotator binary", () => {
    const originalBeBun = process.env.BUN_BE_BUN;

    try {
      process.env.BUN_BE_BUN = "1";
      expect(buildEnv({ PLANNOTATOR_ORIGIN: "amp" }).BUN_BE_BUN).toBeUndefined();
    } finally {
      restoreEnv("BUN_BE_BUN", originalBeBun);
    }
  });

  test("matches shared Plannotator data directory semantics", () => {
    const originalDataDir = process.env.PLANNOTATOR_DATA_DIR;

    try {
      process.env.PLANNOTATOR_DATA_DIR = String.raw`~\plannotator-data`;
      expect(getPlannotatorDataDir()).toBe(join(homedir(), "plannotator-data"));

      process.env.PLANNOTATOR_DATA_DIR = "relative-plannotator-data";
      expect(getPlannotatorDataDir()).toBe(resolve("relative-plannotator-data"));
    } finally {
      restoreEnv("PLANNOTATOR_DATA_DIR", originalDataDir);
    }
  });
});

describe("Amp Plannotator binary-client wiring", () => {
  test("review sends origin amp, joined args, and appends prompt feedback", async () => {
    const captured: { binaryPath?: string; request?: Record<string, unknown> } = {};
    const appended: string[] = [];
    const notes: string[] = [];

    const deps: BinaryClientDeps = {
      ensurePlannotatorBinary: () => okBinary(),
      runPluginReview: async (binaryPath, request) => {
        captured.binaryPath = binaryPath;
        captured.request = request as unknown as Record<string, unknown>;
        return success<PluginReviewResult>({ approved: true, prompt: "LGTM, ship it." });
      },
    };

    await runReview(fakeAmp(), fakeCtx({ appended, notes }), "--git https://example.com/pr/1", deps);

    expect(captured.binaryPath).toBe("/bin/plannotator");
    expect(captured.request).toMatchObject({
      origin: "amp",
      args: "--git https://example.com/pr/1",
      sharingEnabled: expect.any(Boolean),
    });
    expect(appended).toEqual(["LGTM, ship it."]);
    expect(notes).toEqual([]);
  });

  test("review falls back to feedback when no prompt is present", async () => {
    const appended: string[] = [];
    const deps: BinaryClientDeps = {
      ensurePlannotatorBinary: () => okBinary(),
      runPluginReview: async () =>
        success<PluginReviewResult>({ approved: false, feedback: "Please fix this bug." }),
    };

    await runReview(fakeAmp(), fakeCtx({ appended }), "", deps);

    expect(appended).toEqual(["Please fix this bug."]);
  });

  test("review exit is a no-op (no append)", async () => {
    const appended: string[] = [];
    const deps: BinaryClientDeps = {
      ensurePlannotatorBinary: () => okBinary(),
      runPluginReview: async () => success<PluginReviewResult>({ approved: false, exit: true }),
    };

    await runReview(fakeAmp(), fakeCtx({ appended }), "", deps);

    expect(appended).toEqual([]);
  });

  test("annotate sends origin amp and the raw target string", async () => {
    const captured: { request?: Record<string, unknown> } = {};
    const appended: string[] = [];
    const deps: BinaryClientDeps = {
      ensurePlannotatorBinary: () => okBinary(),
      runPluginAnnotate: async (_binaryPath, request) => {
        captured.request = request as unknown as Record<string, unknown>;
        return success<PluginAnnotateResult>({ feedback: "", prompt: "Address the annotations." });
      },
    };

    await runAnnotate(fakeAmp(), fakeCtx({ appended }), "docs/plan.md --gate", deps);

    expect(captured.request).toMatchObject({ origin: "amp", args: "docs/plan.md --gate" });
    expect(appended).toEqual(["Address the annotations."]);
  });

  test("annotate-last sends origin amp, mode, markdown, and last-message file path", async () => {
    const captured: { request?: Record<string, unknown> } = {};
    const appended: string[] = [];
    const deps: BinaryClientDeps = {
      ensurePlannotatorBinary: () => okBinary(),
      runPluginAnnotate: async (_binaryPath, request) => {
        captured.request = request as unknown as Record<string, unknown>;
        return success<PluginAnnotateResult>({ feedback: "", prompt: "Revise the message." });
      },
    };

    await runAnnotateLast(fakeAmp(), fakeCtx({ appended }), "assistant message body", deps);

    expect(captured.request).toMatchObject({
      origin: "amp",
      mode: "annotate-last",
      markdown: "assistant message body",
      filePath: "last-message",
    });
    expect(appended).toEqual(["Revise the message."]);
  });

  test("annotate approved is a no-op (no append)", async () => {
    const appended: string[] = [];
    const notes: string[] = [];

    await handleAnnotateResult(
      fakeCtx({ appended, notes }),
      success<PluginAnnotateResult>({ feedback: "", approved: true }),
      { kind: "message" },
    );

    expect(appended).toEqual([]);
    expect(notes).toEqual(["Annotation session closed."]);
  });

  test("annotate falls back to template-wrapped feedback when no prompt", async () => {
    const appended: string[] = [];

    await handleAnnotateResult(
      fakeCtx({ appended }),
      success<PluginAnnotateResult>({ feedback: "Comment: tighten this section." }),
      { kind: "file", filePath: "docs/plan.md" },
    );

    expect(appended).toEqual([
      "# Markdown Annotations\n\nFile: docs/plan.md\n\nComment: tighten this section.\n\nPlease address the annotation feedback above.",
    ]);
  });

  test("review error surfaces the plugin error message", async () => {
    const notes: string[] = [];

    await handleReviewResult(
      fakeCtx({ notes }),
      error("plugin-command-failed", "daemon unavailable"),
    );

    expect(notes[0]).toContain("daemon unavailable");
  });

  test("missing binary notifies an install hint", async () => {
    const notes: string[] = [];
    const deps: BinaryClientDeps = {
      ensurePlannotatorBinary: () => ({
        ok: false,
        code: "missing-binary",
        message: "The Plannotator binary was not found and automatic installation is disabled.",
        checked: [],
      }),
    };

    await runReview(fakeAmp(), fakeCtx({ notes }), "", deps);

    expect(notes[0]).toContain("Plannotator review failed.");
    expect(notes[0]).toContain("https://plannotator.ai/docs/getting-started/installation/");
  });
});

function okBinary(): EnsurePlannotatorBinaryResult {
  return {
    ok: true,
    path: "/bin/plannotator",
    source: "path",
    installed: false,
    capabilities: {
      protocol: "plannotator-plugin",
      protocolVersion: 2,
      minClientVersion: 1,
      features: ["capabilities", "plan-review", "code-review", "annotate", "annotate-last"],
      daemonReady: true,
    },
  };
}

function success<T extends PluginReviewResult | PluginAnnotateResult>(result: T): PluginResponse<T> {
  return createPluginSuccessResponse(result) as PluginResponse<T>;
}

function error(code: string, message: string): PluginResponse<never> {
  return createPluginErrorResponse(code, message) as PluginResponse<never>;
}

function fakeAmp(): Parameters<typeof runReview>[0] {
  return {
    logger: { log: () => {} },
  } as unknown as Parameters<typeof runReview>[0];
}

function fakeCtx(
  sinks: { appended?: string[]; notes?: string[] },
): Parameters<typeof handleReviewResult>[0] {
  return {
    $: async () => ({ exitCode: 0, stdout: `${process.cwd()}\n`, stderr: "" }),
    ui: {
      notify: async (message: string) => {
        sinks.notes?.push(message);
      },
    },
    thread: {
      append: async (entries: Array<{ type: string; content: string }>) => {
        for (const entry of entries) sinks.appended?.push(entry.content);
      },
    },
  } as unknown as Parameters<typeof handleReviewResult>[0];
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function commandContextWithCwd(cwd: string): Parameters<typeof resolveCwd>[0] {
  return {
    $: async () => ({ exitCode: 0, stdout: `${cwd}\n`, stderr: "" }),
  } as Parameters<typeof resolveCwd>[0];
}
