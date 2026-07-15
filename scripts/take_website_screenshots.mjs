import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://localhost:4173/Convo-Ai/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Hero
  await page.screenshot({ path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/website-hero.png" });
  console.log("Saved website-hero.png");

  // Scroll to features
  await page.evaluate(() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/website-features.png" });
  console.log("Saved website-features.png");

  // Scroll to demo
  await page.evaluate(() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" }));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/website-demo.png" });
  console.log("Saved website-demo.png");

  // Scroll to pipeline
  await page.evaluate(() => document.getElementById("pipeline")?.scrollIntoView({ behavior: "smooth" }));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/website-pipeline.png" });
  console.log("Saved website-pipeline.png");

  // Scroll to install
  await page.evaluate(() => document.getElementById("install")?.scrollIntoView({ behavior: "smooth" }));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/website-install.png" });
  console.log("Saved website-install.png");

  // Scroll to stack
  await page.evaluate(() => document.getElementById("stack")?.scrollIntoView({ behavior: "smooth" }));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/Users/bradleymatera/Desktop/convo-ai-isolated/Convo-Ai/assets/screenshots/website-stack.png" });
  console.log("Saved website-stack.png");

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
