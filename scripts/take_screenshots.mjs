import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Frontend screenshot
  await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui.png",
    fullPage: false,
  });
  console.log("Saved web-ui.png");

  // Type a message to show interaction
  const input = page.locator('input[placeholder*="Type"]');
  if (await input.isVisible()) {
    await input.fill("Hello Jarvis, what can you do?");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/web-ui-typing.png",
    });
    console.log("Saved web-ui-typing.png");
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

  // Website screenshot
  await page.goto("http://localhost:4174/Convo-Ai/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/website-hero.png",
    fullPage: false,
  });
  console.log("Saved website-hero.png");

  // Scroll to features
  await page.evaluate(() => document.getElementById("features")?.scrollIntoView());
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/website-features.png",
  });
  console.log("Saved website-features.png");

  // Scroll to install
  await page.evaluate(() => document.getElementById("install")?.scrollIntoView());
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/website-install.png",
  });
  console.log("Saved website-install.png");

  // Full page website
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/website-full.png",
    fullPage: true,
  });
  console.log("Saved website-full.png");

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
