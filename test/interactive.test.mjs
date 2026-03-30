import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { chromium } from "playwright-core";

const ROOT = process.cwd();
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

function createStaticServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const relativePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const filePath = path.join(ROOT, relativePath);

    try {
      const file = await readFile(filePath);
      response.writeHead(200, {
        "content-type": MIME_TYPES[path.extname(filePath)] ?? "text/plain; charset=utf-8",
      });
      response.end(file);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
    }
  });
}

function centerOf(box) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

async function dragBetween(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 18 });
  await page.mouse.up();
}

let server;
let browser;
let baseUrl;

test.before(async () => {
  server = createStaticServer();
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--disable-gpu"],
  });
});

test.after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test("default anchors align in ad and paper scenes", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__soakDemo));
  await page.evaluate(() => window.__soakDemo.pauseMotion());
  await page.waitForTimeout(180);

  const results = await page.evaluate(() => ({
    ad: window.__soakDemo.getAnchorResults("ad"),
    paper: window.__soakDemo.getAnchorResults("paper"),
  }));

  for (const anchor of results.ad) {
    assert.equal(anchor.unit, anchor.targetUnit, `ad anchor ${anchor.id} should align to target column`);
    assert.ok(Math.abs(anchor.top - 6) < 24, `ad anchor ${anchor.id} should start near the top of its column`);
  }

  for (const anchor of results.paper) {
    assert.equal(anchor.unit, anchor.targetUnit, `paper anchor ${anchor.id} should align to target page`);
    assert.ok(Math.abs(anchor.top - 6) < 24, `paper anchor ${anchor.id} should start near the top of its page`);
  }

  await page.close();
});

test("column selector updates availability and skyline overlaps the ad flow", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__soakDemo));
  await page.evaluate(() => window.__soakDemo.pauseMotion());

  await page.click('#columnSelector [data-columns="2"]');
  await page.waitForFunction(() =>
    document.getElementById("columnSummary").textContent.includes("2 columns active"),
  );

  const state = await page.evaluate(() => {
    const skyline = document.querySelector(".skyline").getBoundingClientRect();
    const flow = document.getElementById("adFlow").getBoundingClientRect();
    const overlap = Math.max(0, Math.min(skyline.bottom, flow.bottom) - Math.max(skyline.top, flow.top));

    return {
      summary: document.getElementById("columnSummary").textContent,
      col3Disabled: document.querySelector('[data-anchor-id="col3"] .soak-toggle').disabled,
      col4Disabled: document.querySelector('[data-anchor-id="col4"] .soak-toggle').disabled,
      col2: window.__soakDemo.getAnchorResults("ad").find((anchor) => anchor.id === "col2"),
      skylineHeight: skyline.height,
      skylineOverlap: overlap,
    };
  });

  assert.match(state.summary, /2 columns active/);
  assert.equal(state.col3Disabled, true);
  assert.equal(state.col4Disabled, true);
  assert.equal(state.col2.unit, 2);
  assert.ok(state.skylineHeight >= 180, "skyline should be large enough to intrude into the scene");
  assert.ok(state.skylineOverlap >= 100, "skyline should overlap the ad text region");

  await page.close();
});

test("dragging a palette object into the ad text moves words and aligns the visible floater", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__soakDemo));
  await page.evaluate(() => {
    window.__soakDemo.pauseMotion();
    window.__soakDemo.clearFloaters();
  });
  await page.waitForTimeout(160);

  const before = await page.evaluate(() => {
    const paragraph = document.querySelector("#adFlow .text-paragraph");
    return Array.from(paragraph.querySelectorAll(".word-token")).map((token, index) => {
      const rect = token.getBoundingClientRect();
      return {
        index,
        word: token.textContent,
        x: rect.left,
        y: rect.top,
      };
    });
  });
  const paletteBox = await page.locator('#floaterPalette [data-kind="hammer"]').boundingBox();
  const dropTarget = await page.evaluate(() => {
    const token = Array.from(document.querySelectorAll("#adFlow .text-paragraph:first-child .word-token")).find(
      (node) => node.textContent === "frame",
    );
    const rect = token.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  });

  await dragBetween(page, centerOf(paletteBox), dropTarget);

  await page.waitForFunction(() =>
    window.__soakDemo.getFloaterSnapshot("ad").length === 1 &&
    window.__soakDemo.getObstacleSnapshot("ad").length === 1,
  );
  await page.waitForTimeout(220);

  const after = await page.evaluate(() => ({
    words: Array.from(document.querySelectorAll("#adFlow .text-paragraph:first-child .word-token")).map(
      (token, index) => {
        const rect = token.getBoundingClientRect();
        return {
          index,
          word: token.textContent,
          x: rect.left,
          y: rect.top,
        };
      },
    ),
    floaterRect: (() => {
      const rect = document.querySelector("#adMotion .floater").getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    })(),
    obstacleRect: (() => {
      const rect = document.querySelector("#adFlow .flow-obstacle").getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    })(),
  }));

  const movedDistances = after.words.map((entry, index) => {
    const previous = before[index];
    return {
      word: entry.word,
      delta: Math.hypot(entry.x - previous.x, entry.y - previous.y),
    };
  });

  assert.ok(
    movedDistances.filter((entry) => entry.delta > 6).length >= 4,
    `expected at least one nearby word to move significantly, saw ${JSON.stringify(movedDistances)}`,
  );

  const floaterCenter = {
    x: after.floaterRect.x + after.floaterRect.width / 2,
    y: after.floaterRect.y + after.floaterRect.height / 2,
  };
  const obstacleCenter = {
    x: after.obstacleRect.x + after.obstacleRect.width / 2,
    y: after.obstacleRect.y + after.obstacleRect.height / 2,
  };

  assert.ok(
    distance(floaterCenter, obstacleCenter) < 18,
    `floater should visually align with its avoidance shape, saw ${distance(floaterCenter, obstacleCenter)}`,
  );

  await page.close();
});

test("paper controls jolt floaters and keep later page anchors aligned", async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__soakDemo));
  await page.evaluate(() => window.__soakDemo.pauseMotion());

  const beforeVelocities = await page.evaluate(() => window.__soakDemo.getFloaterSnapshot("paper"));
  await page.click("#paperJolt");
  await page.waitForTimeout(80);
  const afterState = await page.evaluate(() => ({
    floaters: window.__soakDemo.getFloaterSnapshot("paper"),
    anchors: window.__soakDemo.getAnchorResults("paper"),
  }));

  assert.ok(
    afterState.floaters.some((floater, index) => {
      const before = beforeVelocities[index];
      return Math.abs(floater.vx - before.vx) > 1 || Math.abs(floater.vy - before.vy) > 1;
    }),
    "paper jolt should change at least one floater velocity",
  );

  for (const anchor of afterState.anchors) {
    assert.equal(anchor.unit, anchor.targetUnit, `paper anchor ${anchor.id} should stay aligned after jolt`);
  }

  await page.close();
});
