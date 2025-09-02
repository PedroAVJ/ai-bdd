import { anthropic } from '@ai-sdk/anthropic';
import type { Page } from '@playwright/test';

export function createComputerTool(page: Page) {
  const viewport = page.viewportSize();
  let x = 0;
  let y = 0;
  const DEFAULT_VIEWPORT = {
    width: 1280,
    height: 720,
  } as const;
  const keyboardShortcuts: Record<string, string[]> = {
    'ctrl+l': ['Control', 'l'],
    'ctrl+a': ['Control', 'a'],
    'ctrl+c': ['Control', 'c'],
    'ctrl+v': ['Control', 'v'],
    'alt+tab': ['Alt', 'Tab'],
    return: ['Enter'],
    enter: ['Enter'],
    esc: ['Escape'],
    tab: ['Tab'],
    delete: ['Delete'],
    backspace: ['Backspace'],
    space: [' '],
    arrowup: ['ArrowUp'],
    arrowdown: ['ArrowDown'],
    arrowleft: ['ArrowLeft'],
    arrowright: ['ArrowRight'],
    page_down: ['PageDown'],
    page_up: ['PageUp'],
  };

  function requireCoords(
    coords: [number, number] | number[] | undefined,
    actionName: string
  ): [number, number] {
    if (!coords || coords.length !== 2) {
      throw new Error(`Coordinates required for ${actionName} action`);
    }
    return coords as [number, number];
  }

  async function keyAction(text?: string): Promise<string> {
    if (!text) {
      throw new Error('Text required for key action');
    }
    const keyText = text.toLowerCase();
    if (keyText in keyboardShortcuts) {
      const keys = keyboardShortcuts[keyText];
      if (!keys) {
        throw new Error('Keys not found');
      }
      for (const key of keys) {
        await page.keyboard.down(key);
      }
      for (const key of [...keys].reverse()) {
        await page.keyboard.up(key);
      }
    } else {
      await page.keyboard.press(text);
    }
    return 'Key pressed';
  }

  const actions: Record<
    string,
    (args: {
      coordinate: number[] | undefined;
      text: string | undefined;
    }) => Promise<string | { type: 'image'; data: string }>
  > = {
    async screenshot() {
      const buffer = await page.screenshot();
      return { type: 'image', data: buffer.toString('base64') } as const;
    },
    async type({
      text,
    }: { coordinate: number[] | undefined; text: string | undefined }) {
      if (!text) {
        throw new Error('Text required for type action');
      }
      await page.keyboard.type(text);
      return 'Text typed';
    },
    async left_click(_args: {
      coordinate: number[] | undefined;
      text: string | undefined;
    }) {
      await page.mouse.click(x, y);
      return 'Left click performed';
    },
    async right_click(_args: {
      coordinate: number[] | undefined;
      text: string | undefined;
    }) {
      await page.mouse.click(x, y, { button: 'right' });
      return 'Right click performed';
    },
    async middle_click(_args: {
      coordinate: number[] | undefined;
      text: string | undefined;
    }) {
      await page.mouse.click(x, y, { button: 'middle' });
      return 'Middle click performed';
    },
    async double_click(_args: {
      coordinate: number[] | undefined;
      text: string | undefined;
    }) {
      await page.mouse.dblclick(x, y);
      return 'Double click performed';
    },
    async left_click_drag({
      coordinate,
    }: { coordinate: number[] | undefined; text: string | undefined }) {
      const [targetX, targetY] = await requireCoords(
        coordinate,
        'left_click_drag'
      );
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(targetX, targetY);
      await page.mouse.up();
      return 'Left click drag performed';
    },
    async mouse_move({
      coordinate,
    }: { coordinate: number[] | undefined; text: string | undefined }) {
      const [targetX, targetY] = await requireCoords(coordinate, 'mouse_move');
      await page.mouse.move(targetX, targetY);
      x = targetX;
      y = targetY;
      return 'Mouse moved';
    },
    cursor_position(_args: {
      coordinate: number[] | undefined;
      text: string | undefined;
    }) {
      return Promise.resolve(`(${x}, ${y})`);
    },
  } as const;

  return anthropic.tools.computer_20241022({
    displayWidthPx: viewport?.width ?? DEFAULT_VIEWPORT.width,
    displayHeightPx: viewport?.height ?? DEFAULT_VIEWPORT.height,
    async execute({ action, coordinate, text }) {
      const handler = actions[action];
      if (handler) {
        return await handler({ coordinate, text });
      }
      return await keyAction(text);
    },
    experimental_toToolResultContent(result) {
      return typeof result === 'string'
        ? [{ type: 'text', text: result }]
        : [{ type: 'image', data: result.data, mimeType: 'image/png' }];
    },
  });
}
