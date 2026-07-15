import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  // Screenshot 1: Empty state with animated orb + quick prompts
  await page.screenshot({
    path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui.png",
  });
  console.log("Saved web-ui.png (empty state with orb)");

  // Click a quick prompt
  const quickBtn = page.locator('button:has-text("Tell me a joke")').first();
  if (await quickBtn.isVisible()) {
    await quickBtn.click();
    console.log("Clicked quick prompt, waiting for response...");
    await page.waitForTimeout(30000);

    // Screenshot 2: With conversation
    await page.screenshot({
      path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui-response.png",
    });
    console.log("Saved web-ui-response.png (with real conversation)");
  }

  // Type a message
  const input = page.locator('input[placeholder*="Message"]');
  if (await input.isVisible()) {
    await input.fill("What can you do, Jarvis?");
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

    // Close settings
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  // Click voice mode (mic button)
  const micBtn = page.locator('button[title*="voice"]').first();
  if (await micBtn.isVisible()) {
    await micBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui-voice.png",
    });
    console.log("Saved web-ui-voice.png (recording state)");
  }

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
