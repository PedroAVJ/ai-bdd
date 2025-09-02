import type { BrowserContext } from '@playwright/test';

declare global {
  interface Window {
    __cursorHighlightInitialized?: boolean;
  }
}

export async function addCursorHighlightingToPage(context: BrowserContext) {
  await context.addInitScript(() => {
    const initCursorHighlight = () => {
      // Check and add style if needed
      if (!document.querySelector('style[data-cursor-highlight]')) {
        const style = document.createElement('style');
        style.setAttribute('data-cursor-highlight', 'true');
        style.textContent = `
          .cursor-highlight {
            position: fixed;
            width: 20px;
            height: 20px;
            background-color: rgba(255, 165, 0, 0.5);
            border-radius: 50%;
            pointer-events: none;
            transform: translate(-50%, -50%);
            transition: all 0.1s ease;
            z-index: 9999;
            box-shadow: 0 0 10px rgba(255, 165, 0, 0.3);
          }
        `;
        document.head.appendChild(style);
      }

      // Check and add cursor element if needed
      if (!document.querySelector('.cursor-highlight')) {
        const cursorHighlight = document.createElement('div');
        cursorHighlight.classList.add('cursor-highlight');
        document.body.appendChild(cursorHighlight);
      }

      // Add event listener if not initialized
      if (!window.__cursorHighlightInitialized) {
        const cursorHighlight = document.querySelector(
          '.cursor-highlight'
        ) as HTMLElement;
        window.addEventListener('mousemove', (event) => {
          cursorHighlight.style.left = `${event.clientX}px`;
          cursorHighlight.style.top = `${event.clientY}px`;
        });
        window.__cursorHighlightInitialized = true;
      }
    };

    // Ensure that DOM is fully loaded before running our initializer
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCursorHighlight);
    } else {
      initCursorHighlight();
    }
  });
}
