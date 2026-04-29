/**
 * Shared feedback templates for all agent integrations.
 *
 * The plan deny template was tuned in #224 / commit 3dca977 to use strong
 * directive framing — Claude was ignoring softer phrasing.
 *
 * This module now routes through the configurable prompt pipeline in prompts.ts.
 * The function signature is preserved for backward compatibility.
 */

import { getPlanDeniedPrompt, buildPlanFileRule } from "./prompts";

export interface PlanDenyFeedbackOptions {
  planFilePath?: string;
}

export const planDenyFeedback = (
  feedback: string,
  toolName: string = "ExitPlanMode",
  options?: PlanDenyFeedbackOptions,
): string => {
  return getPlanDeniedPrompt(null, undefined, {
    toolName,
    planFileRule: buildPlanFileRule(toolName, options?.planFilePath),
    feedback: feedback || "Plan changes requested",
  });
};
