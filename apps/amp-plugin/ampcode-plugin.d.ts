/**
 * Minimal ambient type surface for `@ampcode/plugin`.
 *
 * The Amp runtime injects this module at load time; it is not installed as a
 * package (the plugin is distributed as a single file copied into
 * `~/.config/amp/plugins/`). These declarations cover only the surface this
 * plugin actually uses so the source typechecks standalone.
 */
declare module "@ampcode/plugin" {
  export interface PluginLogger {
    log(...args: unknown[]): void;
  }

  export interface CommandSpec {
    title: string;
    category?: string;
    description?: string;
  }

  export interface PluginAPI {
    logger: PluginLogger;
    registerCommand(
      id: string,
      spec: CommandSpec,
      handler: (ctx: PluginCommandContext) => void | Promise<void>,
    ): void;
  }

  export interface UiInputOptions {
    title?: string;
    helpText?: string;
    submitButtonText?: string;
  }

  export interface PluginUI {
    input(options: UiInputOptions): Promise<string | undefined>;
    notify(message: string): Promise<void>;
  }

  export interface ThreadAppendEntry {
    type: "user-message";
    content: string;
  }

  export interface ThreadMessagesQuery {
    from?: "start" | "end";
    limit?: number;
    roles?: Array<"assistant" | "user">;
  }

  export interface Thread {
    messages(query?: ThreadMessagesQuery): Promise<ThreadMessage[]>;
    append(entries: ThreadAppendEntry[]): Promise<void>;
  }

  export interface ShellResult {
    exitCode: number;
    stdout: string;
    stderr: string;
  }

  export interface PluginCommandContext {
    ui: PluginUI;
    thread?: Thread;
    $(strings: TemplateStringsArray, ...values: unknown[]): Promise<ShellResult>;
  }

  export interface ThreadMessageContentBlock {
    type: string;
    text?: string;
    thinking?: string;
    [key: string]: unknown;
  }

  export interface ThreadMessage {
    role: "assistant" | "user";
    id: string;
    content: ThreadMessageContentBlock[];
  }
}
