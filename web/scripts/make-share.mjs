import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>*{box-sizing:border-box}body{margin:0;background:#090b09;color:#f0f2e9;font-family:Arial,Helvetica,sans-serif}main{padding:64px;width:1200px;height:630px;border-top:10px solid #d7ff3f}h1{font-size:72px;line-height:1.1;margin:50px 0 28px}p{font-size:28px;color:#a4ad9e;margin:0}.symbol{font:700 32px Consolas,monospace;color:#d7ff3f}.line{height:12px;background:#d7ff3f;width:320px;margin:36px 0}.foot{margin-top:40px;font-size:22px}</style><main><div class="symbol">NAP / ETH · SEPOLIA</div><h1>Hamster Nap 3D</h1><p>Trade NAP. Track the prize pool.</p><div class="line"></div><p>Last buyer before three zero-work rounds.</p><p class="foot">Unofficial community game · Test tokens have no value</p></main>`,
  );
  await page.screenshot({
    path: fileURLToPath(new URL("../public/share.png", import.meta.url)),
  });
  console.log("Generated 1200 × 630 share.png.");
} finally {
  await browser.close();
}
