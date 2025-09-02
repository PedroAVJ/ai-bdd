import type { Page } from '@playwright/test';
import { createComputerTool, createDomTools } from './tools';

import { anthropic } from '@ai-sdk/anthropic';
import { Output, generateText } from 'ai';
import { z } from 'zod';

export async function executor({
  page,
  instruction,
  systemPrompt,
}: {
  page: Page;
  instruction: string;
  systemPrompt: string;
}) {
  const computerTool = createComputerTool(page);
  const domTools = createDomTools(page);

  const {
    experimental_output: { success, reason },
  } = await generateText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    system: systemPrompt,
    prompt: instruction,
    tools: {
      // @ts-expect-error exactOptionalPropertyTypes causes some headaches
      computer: computerTool,
      ...domTools,
    },
    maxSteps: 40,
    experimental_output: Output.object({
      schema: z.object({
        success: z
          .boolean()
          .describe(
            'Indicates whether the instruction was fully executed without errors or unexpected issues. ' +
              'Set this to true only if all steps were carried out as intended and the goal was achieved.'
          ),
        reason: z
          .string()
          .describe(
            'Describes the final outcome. If successful, summarize what was done to fulfill the instruction. ' +
              'If it failed, include any error details or unexpected conditions that prevented successful execution.'
          ),
      }),
    }),
  });

  if (!success) {
    throw new Error(reason);
  }
}
