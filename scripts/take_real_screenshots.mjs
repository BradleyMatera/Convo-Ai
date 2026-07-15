import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Go to the frontend
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Screenshot 1: Initial state (with previous session loaded)
  await page.screenshot({
    path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui.png",
  });
  console.log("Saved web-ui.png (initial state)");

  // Type a message
  const input = page.locator('input[placeholder*="Type"]');
  if (await input.isVisible()) {
    await input.fill("Hello Jarvis, what is 2 plus 2?");
    await page.waitForTimeout(500);

    // Screenshot 2: Typing
    await page.screenshot({
      path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui-typing.png",
    });
    console.log("Saved web-ui-typing.png");

    // Send the message
    await input.press("Enter");

    // Wait for the response (Ollama + TTS can take a while)
    console.log("Waiting for Ollama response...");
    await page.waitForTimeout(30000);

    // Screenshot 3: With response
    await page.screenshot({
      path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui-response.png",
    });
    console.log("Saved web-ui-response.png (with real response)");
  }

  // Switch to voice mode
  const voiceBtn = page.locator('button:has-text("Voice")').first();
  if (await voiceBtn.isVisible()) {
    await voiceBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui-voice.png",
    });
    console.log("Saved web-ui-voice.png");
  }

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
