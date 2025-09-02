import type { Page } from '@playwright/test';
import { tool } from 'ai';
import { z } from 'zod';

export function createDomTools(page: Page) {
  return {
    getAllLinks: tool({
      description: `
Retrieves the href attributes from all anchor (<a>) elements on the current webpage. 
This should be your primary tool for navigation purposes, as it provides the most consistent way to find valid navigation targets.
Use this tool to collect every link reference (URL or path) that is present in the DOM before attempting navigation.
It returns an array of strings representing the href attributes for each anchor, which can then be used with the navigateTo tool.
      `,
      parameters: z.object({}),
      execute: async () => {
        const links = await page.locator('a').all();
        const hrefs = await Promise.all(
          links.map(async (link) => link.getAttribute('href'))
        );
        const validHrefs = hrefs.filter(
          (href): href is string => href !== null
        );
        return `Found ${validHrefs.length} links. Choose one of these links to navigate to using the navigateTo tool:\n${validHrefs.join('\n')}`;
      },
    }),
    navigateTo: tool({
      description: `
Navigates the browser to a specified URL or route.
This is the preferred method for navigation as it provides the most consistent and reliable way to change pages.
Use this tool in conjunction with getAllLinks to first discover valid navigation targets and then navigate to them.
The "href" parameter must be a valid URL or path recognized by the browser; it can be either absolute (e.g., "https://example.com") or relative (e.g., "/login").
This tool does not validate the existence or reachability of the target—if the URL is invalid, the navigation may fail.
Once navigation completes, any references to the old DOM become stale, so subsequent actions should be performed on the new page context.
      `,
      parameters: z.object({
        href: z
          .string()
          .describe(
            'The valid URL or path to navigate to, which can be absolute or relative.'
          ),
      }),
      execute: async ({ href }) => {
        await page.goto(href);
      },
    }),
    getStructuredContent: tool({
      description: `
This is the preferred method for validating the presence and structure of content on the current webpage.
It returns a simplified representation of the page's text content, showing only the immediate HTML tag containing each text node.
Use this tool when you need to verify specific text content exists or check what type of element contains specific text.

Example output for a simple page:
<header>Welcome to Our Site</header>
<h1>Main Heading</h1>
<div>Some content in a div</div>
<p>A paragraph with nested content</p>

The output shows each piece of text content wrapped in its immediate containing element.
Script tags and other non-content elements are automatically filtered out to focus on user-visible content.
      `,
      parameters: z.object({}),
      execute: async () => {
        const structuredText = await page.evaluate(() => {
          function getStructuredText(element: Element): string {
            // Skip script and style tags
            if (['script', 'style'].includes(element.tagName.toLowerCase())) {
              return '';
            }

            // Get direct text content (excluding child elements)
            const directText = Array.from(element.childNodes)
              .filter((node) => node.nodeType === Node.TEXT_NODE)
              .map((node) => node.textContent?.trim())
              .filter((text) => text)
              .join(' ');

            // If this element has direct text, return it wrapped in its tag
            if (directText) {
              const tagName = element.tagName.toLowerCase();
              return `<${tagName}>${directText}</${tagName}>\n`;
            }

            // Process child elements
            return Array.from(element.children)
              .map((child) => getStructuredText(child))
              .filter((text) => text)
              .join('');
          }

          return getStructuredText(document.body);
        });
        return structuredText;
      },
    }),
    getAllInputs: tool({
      description: `
Retrieves only the name attributes of all input elements on the current webpage.
This should be your primary tool for discovering form inputs, as it provides the most consistent way to interact with forms.
If an input element does not have a name, it will be ignored.
Use this tool to discover which input fields are present (by name) before using typeIntoInput to type into one of them.
Always prefer this method over vision-based or text-based form interactions for better reliability.
      `,
      parameters: z.object({}),
      execute: async () => {
        const inputs = await page.locator('input').all();
        const inputData = await Promise.all(
          inputs.map(async (input) => {
            const nameAttr = await input.getAttribute('name');
            return nameAttr ? `name="${nameAttr}"` : null;
          })
        );
        const filteredInputData = inputData.filter((item) => item !== null);
        return `Found ${filteredInputData.length} named inputs. Choose one to type into using the typeIntoInput tool:\n${filteredInputData.join('\n')}`;
      },
    }),
    typeIntoInput: tool({
      description: `
Types the given text into an input field identified by its "name" attribute.
This is the preferred method for filling out forms as it's more reliable than vision-based or text-based approaches.
If no input with the specified name exists, the command will fail.
Use getAllInputs to list all input name attributes on the page before calling this tool.
This approach provides the most consistent and stable way to interact with form inputs across different page layouts and states.
      `,
      parameters: z.object({
        inputName: z
          .string()
          .describe('Name attribute of the input element to type into.'),
        text: z.string().describe('The text to type into the input.'),
      }),
      execute: async ({ inputName, text }) => {
        // Fill the input by name
        await page.fill(`input[name="${inputName}"]`, text);
        return `Typed "${text}" into input with name="${inputName}"`;
      },
    }),
    listAllSubmitButtons: tool({
      description: `
Lists all submit buttons (both <button type="submit"> and <input type="submit">) on the current webpage that are not disabled.
Use this tool to discover which submit buttons are present so that you can call clickSubmitButton with the index you want to click.
      `,
      parameters: z.object({}),
      execute: async () => {
        const buttons = await page
          .locator(
            'button[type="submit"]:not(:disabled), input[type="submit"]:not(:disabled)'
          )
          .all();

        // Collect a descriptive label for each button to help identify them
        // For <button> elements, we can grab the text content, and for <input>, the 'value' attribute
        const buttonData = await Promise.all(
          buttons.map(async (btn) => {
            const tagName = await btn.evaluate((el) =>
              el.tagName.toLowerCase()
            );
            if (tagName === 'button') {
              const buttonText = await btn.innerText();
              return `Button: "${buttonText}"`;
            }
            const valueAttr = await btn.getAttribute('value');
            return `Input: value="${valueAttr ?? ''}"`;
          })
        );

        if (buttonData.length === 0) {
          return 'No active (enabled) submit buttons found on the page.';
        }

        return `Found ${buttonData.length} active submit button(s). Use clickSubmitButton to click one by index:\n${buttonData
          .map((desc, idx) => `${idx}: ${desc}`)
          .join('\n')}`;
      },
    }),
    clickSubmitButton: tool({
      description: `
Clicks on a submit button by providing its zero-based index from the previously returned list of submit buttons in "listAllSubmitButtons".
Use this tool after calling listAllSubmitButtons to identify which button you want to click.
      `,
      parameters: z.object({
        index: z
          .number()
          .describe('The zero-based index of the submit button to click.'),
      }),
      execute: async ({ index }) => {
        const buttons = await page
          .locator(
            'button[type="submit"]:not(:disabled), input[type="submit"]:not(:disabled)'
          )
          .all();

        if (buttons.length === 0) {
          throw new Error('No active submit buttons found on the page.');
        }

        if (index < 0 || index >= buttons.length) {
          throw new Error(
            `Invalid index. Must be between 0 and ${buttons.length - 1}.`
          );
        }

        const button = buttons[index];
        if (!button) {
          throw new Error(`No button found at index ${index}`);
        }
        await button.click();
        return `Clicked submit button at index ${index}.`;
      },
    }),
  };
}
