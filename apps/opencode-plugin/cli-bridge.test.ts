import { describe, expect, mock, test } from "bun:test";
import {
  buildCliBridgeEnv,
  buildReviewPromptFromBridgeOutcome,
  getRecentAssistantMessages,
} from "./cli-bridge";

describe("OpenCode CLI bridge helpers", () => {
  test("maps OpenCode sharing context into child CLI env", () => {
    expect(buildCliBridgeEnv({
      sharingEnabled: false,
      shareBaseUrl: "https://share.example.test",
      pasteApiUrl: "https://paste.example.test",
    })).toEqual({
      PLANNOTATOR_SHARE: "disabled",
      PLANNOTATOR_SHARE_URL: "https://share.example.test",
      PLANNOTATOR_PASTE_URL: "https://paste.example.test",
    });

    expect(buildCliBridgeEnv({ sharingEnabled: true })).toEqual({
      PLANNOTATOR_SHARE: "enabled",
    });
  });

  test("collects recent assistant messages newest-first with ids and timestamps", async () => {
    const client = {
      session: {
        messages: mock(async () => ({
          data: [
            {
              info: { role: "assistant", id: "old", time: { created: 1_700_000_000_000 } },
              parts: [{ type: "text", text: "Old" }],
            },
            {
              info: { role: "user", id: "user" },
              parts: [{ type: "text", text: "Ignore me" }],
            },
            {
              info: { role: "assistant", id: "latest", time: { created: 1_700_000_001_000 } },
              parts: [{ type: "text", text: "Latest" }],
            },
          ],
        })),
      },
    };

    const messages = await getRecentAssistantMessages(client, "session-1");

    expect(messages).toEqual([
      {
        messageId: "latest",
        text: "Latest",
        timestamp: new Date(1_700_000_001_000).toISOString(),
      },
      {
        messageId: "old",
        text: "Old",
        timestamp: new Date(1_700_000_000_000).toISOString(),
      },
    ]);
  });

  test("formats structured review outcomes for OpenCode prompt injection", () => {
    expect(buildReviewPromptFromBridgeOutcome({
      decision: "dismissed",
    })).toEqual({ message: null });

    const approved = buildReviewPromptFromBridgeOutcome({
      decision: "approved",
      approved: true,
      agentSwitch: "build",
    });
    expect(approved.agent).toBe("build");
    expect(approved.message).toContain("Code Review");

    const localFeedback = buildReviewPromptFromBridgeOutcome({
      decision: "annotated",
      approved: false,
      isPRMode: false,
      feedback: "Fix these issues.",
      agentSwitch: "disabled",
    });
    expect(localFeedback.agent).toBeUndefined();
    expect(localFeedback.message).toContain("Fix these issues.");
    expect(localFeedback.message).toContain("Please address this feedback.");

    const prFeedback = buildReviewPromptFromBridgeOutcome({
      decision: "annotated",
      approved: false,
      isPRMode: true,
      feedback: "PR comment only.",
    });
    expect(prFeedback.message).toBe("PR comment only.");
  });
});
