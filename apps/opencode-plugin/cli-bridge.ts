import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseAnnotateArgs } from "@plannotator/shared/annotate-args";
import { parseReviewArgs } from "@plannotator/shared/review-args";
import {
  getAnnotateFileFeedbackPrompt,
  getAnnotateMessageFeedbackPrompt,
} from "@plannotator/shared/prompts";

type LogLevel = "info" | "error";

interface OpenCodeClient {
  app?: {
    log?: (entry: { level: LogLevel; message: string }) => unknown;
  };
  session?: {
    messages?: (input: unknown) => Promise<{ data?: any[] }>;
    prompt?: (input: unknown) => Promise<unknown>;
  };
}

export interface OpenCodePlanReviewResult {
  approved: boolean;
  feedback?: string;
  savedPath?: string;
  agentSwitch?: string;
}

interface RunCliOptions {
  client: OpenCodeClient;
  args: string[];
  cwd?: string;
  input?: string;
  readyLabel: string;
  extraEnv?: Record<string, string | undefined>;
}

interface RunCliResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

interface CliAnnotateOutcome {
  decision?: "approved" | "dismissed" | "annotated";
  feedback?: string;
}

function log(client: OpenCodeClient, level: LogLevel, message: string): void {
  try {
    void client.app?.log?.({ level, message });
  } catch {
    // OpenCode logging is best-effort.
  }
}

function getPlannotatorBin(): string {
  return process.env.PLANNOTATOR_BIN?.trim() || "plannotator";
}

function parseLastJson<T>(stdout: string): T {
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.startsWith("{")) continue;
    return JSON.parse(line) as T;
  }
  throw new Error("Plannotator CLI did not return JSON.");
}

function logReadyFile(client: OpenCodeClient, readyFile: string, readyLabel: string, loggedUrls: Set<string>): void {
  if (!existsSync(readyFile)) return;

  const contents = readFileSync(readyFile, "utf-8");
  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const metadata = JSON.parse(line) as { url?: string };
      if (!metadata.url || loggedUrls.has(metadata.url)) continue;
      loggedUrls.add(metadata.url);
      log(client, "info", `[Plannotator] Open ${readyLabel}: ${metadata.url}`);
    } catch {
      // Ignore partial lines while the child process is writing.
    }
  }
}

async function runPlannotatorCli(options: RunCliOptions): Promise<RunCliResult> {
  const readyFile = path.join(
    tmpdir(),
    `plannotator-opencode-${process.pid}-${Date.now()}-${randomUUID()}.jsonl`,
  );
  const loggedUrls = new Set<string>();
  const cwd = options.cwd || process.cwd();
  const env = {
    ...process.env,
    ...options.extraEnv,
    OPENCODE: "1",
    PLANNOTATOR_ORIGIN: "opencode",
    PLANNOTATOR_CWD: cwd,
    PLANNOTATOR_READY_FILE: readyFile,
  };

  const bin = getPlannotatorBin();
  log(options.client, "info", `[Plannotator] Starting ${options.readyLabel}...`);

  return await new Promise((resolve, reject) => {
    const child = spawn(bin, options.args, {
      cwd,
      env,
      shell: process.platform === "win32" && !path.isAbsolute(bin),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const interval = setInterval(
      () => logReadyFile(options.client, readyFile, options.readyLabel, loggedUrls),
      250,
    );

    if (!child.stdin || !child.stdout || !child.stderr) {
      clearInterval(interval);
      rmSync(readyFile, { force: true });
      reject(new Error("Failed to open pipes for the plannotator CLI process."));
      return;
    }

    child.stdout.setEncoding("utf-8");
    child.stderr.setEncoding("utf-8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      clearInterval(interval);
      logReadyFile(options.client, readyFile, options.readyLabel, loggedUrls);
      rmSync(readyFile, { force: true });
      if (error.code === "ENOENT") {
        reject(new Error("Could not find the plannotator CLI. Install it with: curl -fsSL https://plannotator.ai/install.sh | bash"));
        return;
      }
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearInterval(interval);
      logReadyFile(options.client, readyFile, options.readyLabel, loggedUrls);
      rmSync(readyFile, { force: true });
      resolve({ stdout, stderr, exitCode });
    });

    child.stdin.end(options.input ?? "");
  });
}

export async function runCliPlanReview(input: {
  client: OpenCodeClient;
  planContent: string;
  cwd?: string;
  timeoutSeconds: number | null;
}): Promise<OpenCodePlanReviewResult> {
  const result = await runPlannotatorCli({
    client: input.client,
    args: ["opencode-plan"],
    cwd: input.cwd,
    input: JSON.stringify({
      plan: input.planContent,
      timeoutSeconds: input.timeoutSeconds,
    }),
    readyLabel: "plan review",
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || `Plannotator CLI exited with code ${result.exitCode}`);
  }

  return parseLastJson<OpenCodePlanReviewResult>(result.stdout);
}

async function injectSessionPrompt(
  client: OpenCodeClient,
  sessionId: string | undefined,
  text: string,
): Promise<void> {
  if (!sessionId || !text.trim()) return;
  try {
    await client.session?.prompt?.({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text }],
      },
    });
  } catch {
    // Session may be unavailable or busy.
  }
}

async function getLastAssistantMessage(client: OpenCodeClient, sessionId: string): Promise<string | null> {
  const messagesResponse = await client.session?.messages?.({
    path: { id: sessionId },
  });
  const messages = messagesResponse?.data;
  if (!messages) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.info?.role !== "assistant") continue;
    const textParts = (msg.parts ?? [])
      .filter((part: any) => part.type === "text" && part.text?.trim())
      .map((part: any) => part.text);
    if (textParts.length > 0) return textParts.join("\n");
  }

  return null;
}

function buildReviewCliArgs(rawArgs: string): string[] {
  const parsed = parseReviewArgs(rawArgs);
  const args = ["review"];
  if (parsed.prUrl) args.push(parsed.prUrl);
  if (parsed.vcsType === "git") args.push("--git");
  if (parsed.prUrl && !parsed.useLocal) args.push("--no-local");
  return args;
}

function getAnnotateFileHeader(filePath: string, cwd?: string): "File" | "Folder" {
  if (/^https?:\/\//i.test(filePath)) return "File";

  try {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(cwd || process.cwd(), filePath);
    return statSync(resolved).isDirectory() ? "Folder" : "File";
  } catch {
    return "File";
  }
}

export async function handleCliCommand(input: {
  command: string;
  client: OpenCodeClient;
  sessionId?: string;
  rawArgs: string;
  cwd?: string;
}): Promise<void> {
  try {
    if (input.command === "plannotator-review") {
      const result = await runPlannotatorCli({
        client: input.client,
        args: buildReviewCliArgs(input.rawArgs),
        cwd: input.cwd,
        readyLabel: "code review",
      });
      if (result.exitCode !== 0) {
        log(input.client, "error", result.stderr.trim() || `Plannotator CLI exited with code ${result.exitCode}`);
        return;
      }

      const feedback = result.stdout.trim();
      if (feedback && feedback !== "Review session closed without feedback.") {
        await injectSessionPrompt(input.client, input.sessionId, feedback);
      }
      return;
    }

    if (input.command === "plannotator-annotate") {
      const parsed = parseAnnotateArgs(input.rawArgs);
      if (!parsed.filePath) {
        log(input.client, "error", "Usage: /plannotator-annotate <file.md | file.html | https://... | folder/> [--gate] [--json]");
        return;
      }

      const args = ["annotate", parsed.rawFilePath, "--json"];
      if (parsed.gate) args.push("--gate");
      if (parsed.renderHtml) args.push("--render-html");

      const result = await runPlannotatorCli({
        client: input.client,
        args,
        cwd: input.cwd,
        readyLabel: "annotation UI",
      });
      if (result.exitCode !== 0) {
        log(input.client, "error", result.stderr.trim() || `Plannotator CLI exited with code ${result.exitCode}`);
        return;
      }

      const outcome = parseLastJson<CliAnnotateOutcome>(result.stdout);
      if (outcome.decision === "annotated" && outcome.feedback) {
        await injectSessionPrompt(
          input.client,
          input.sessionId,
          getAnnotateFileFeedbackPrompt("opencode", undefined, {
            fileHeader: getAnnotateFileHeader(parsed.filePath, input.cwd),
            filePath: parsed.filePath,
            feedback: outcome.feedback,
          }),
        );
      }
      return;
    }

    if (input.command === "plannotator-last") {
      if (!input.sessionId) {
        log(input.client, "error", "No active session.");
        return;
      }

      const lastText = await getLastAssistantMessage(input.client, input.sessionId);
      if (!lastText) {
        log(input.client, "error", "No assistant message found in session.");
        return;
      }

      const parsed = parseAnnotateArgs(input.rawArgs);
      const args = ["annotate-last", "--stdin", "--json"];
      if (parsed.gate) args.push("--gate");

      const result = await runPlannotatorCli({
        client: input.client,
        args,
        cwd: input.cwd,
        input: lastText,
        readyLabel: "annotation UI",
      });
      if (result.exitCode !== 0) {
        log(input.client, "error", result.stderr.trim() || `Plannotator CLI exited with code ${result.exitCode}`);
        return;
      }

      const outcome = parseLastJson<CliAnnotateOutcome>(result.stdout);
      if (outcome.decision === "annotated" && outcome.feedback) {
        await injectSessionPrompt(
          input.client,
          input.sessionId,
          getAnnotateMessageFeedbackPrompt("opencode", undefined, { feedback: outcome.feedback }),
        );
      }
      return;
    }

    if (input.command === "plannotator-archive") {
      const result = await runPlannotatorCli({
        client: input.client,
        args: ["archive"],
        cwd: input.cwd,
        readyLabel: "archive",
      });
      if (result.exitCode !== 0) {
        log(input.client, "error", result.stderr.trim() || `Plannotator CLI exited with code ${result.exitCode}`);
      }
    }
  } catch (error) {
    log(input.client, "error", `[Plannotator] ${error instanceof Error ? error.message : String(error)}`);
  }
}
