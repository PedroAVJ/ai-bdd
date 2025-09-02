import { executor } from '@/bdd/executor';
import {
  ASSERT_SYSTEM_PROMPT,
  GIVEN_SYSTEM_PROMPT,
  WHEN_SYSTEM_PROMPT,
} from '@/bdd/system-prompts';
import { test as base } from '@playwright/test';
import { addCursorHighlightingToPage } from './cursor-highlighting';

type BDDFixture = {
  given: (instructions: string) => Promise<void>;
  when: (instructions: string) => Promise<void>;
  // "then" is a reserved word in TypeScript, so we use "assert" instead :(
  assert: (instructions: string) => Promise<void>;
};

export const test = base.extend<BDDFixture>({
  context: async ({ context }, use) => {
    // Add the highlighting script to the context init scripts
    await addCursorHighlightingToPage(context);
    await use(context);
  },

  given: async ({ page }, use) => {
    await use(async (instruction: string) => {
      await executor({ page, instruction, systemPrompt: GIVEN_SYSTEM_PROMPT });
    });
  },
  when: async ({ page }, use) => {
    await use(async (instruction: string) => {
      await executor({ page, instruction, systemPrompt: WHEN_SYSTEM_PROMPT });
    });
  },
  assert: async ({ page }, use) => {
    await use(async (instruction: string) => {
      await executor({ page, instruction, systemPrompt: ASSERT_SYSTEM_PROMPT });
    });
  },
});
