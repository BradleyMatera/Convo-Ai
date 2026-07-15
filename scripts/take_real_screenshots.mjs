import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  // Screenshot 1: Empty state with orb + quick prompts
  await page.screenshot({
    path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui.png",
  });
  console.log("Saved web-ui.png (empty state)");

  // Click "My name is Bradley" quick prompt
  const nameBtn = page.locator('button:has-text("My name is Bradley")').first();
  if (await nameBtn.isVisible()) {
    await nameBtn.click();
    console.log("Clicked name prompt, waiting for response...");
    await page.waitForTimeout(40000);
    await page.screenshot({
      path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui-response.png",
    });
    console.log("Saved web-ui-response.png (with conversation + memory indicators)");
  }

  // Click Memory tab
  const memoryTab = page.locator('button:has-text("memory")').first();
  if (await memoryTab.isVisible()) {
    await memoryTab.click();
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui-memory.png",
    });
    console.log("Saved web-ui-memory.png (memory panel)");
  }

  // Click Personality tab
  const personalityTab = page.locator('button:has-text("personality")').first();
  if (await personalityTab.isVisible()) {
    await personalityTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui-personality.png",
    });
    console.log("Saved web-ui-personality.png (personality editor)");
  }

  // Back to chat tab, type a message
  const chatTab = page.locator('button:has-text("chat")').first();
  if (await chatTab.isVisible()) {
    await chatTab.click();
    await page.waitForTimeout(500);
  }
  const input = page.locator('input[placeholder*="Message"]').first();
  if (await input.isVisible()) {
    await input.fill("What is my name?");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui-typing.png",
    });
    console.log("Saved web-ui-typing.png");
  }

  // Open settings
  const settingsBtn = page.locator('button:has-text("Settings")').first();
  if (await settingsBtn.isVisible()) {
    await settingsBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui-settings.png",
    });
    console.log("Saved web-ui-settings.png");
    await page.keyboard.press("Escape");
  }

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
