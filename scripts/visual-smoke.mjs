import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import zlib from "node:zlib";

const root = resolve(".");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outDir = join(root, "artifacts", "visual-smoke");
const profileDir = join(tmpdir(), "codex-slime-battle-visual-smoke-chrome");
const port = Number(process.env.CDP_PORT ?? 9333);
const baseUrl = process.env.SMOKE_URL ?? "http://127.0.0.1:5173/";

const viewports = [
  { name: "growth-iphone-se", width: 375, height: 667, clicks: [] },
  { name: "growth-iphone-13", width: 390, height: 844, clicks: [] },
  { name: "strategy-iphone-13", width: 390, height: 844, clicks: [{ x: 286, y: 34 }] },
  { name: "battle-iphone-13", width: 390, height: 844, clicks: [{ x: 360, y: 34 }] },
  { name: "battle-running-iphone-13", width: 390, height: 844, clicks: [{ x: 360, y: 34 }, { x: 195, y: 565 }] },
  { name: "growth-desktop", width: 1280, height: 720, clicks: [] },
];

await mkdir(outDir, { recursive: true });
await rm(profileDir, { recursive: true, force: true });
await mkdir(profileDir, { recursive: true });

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-default-apps",
    "--no-proxy-server",
    "--proxy-server=direct://",
    "--proxy-bypass-list=*",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);

let stderr = "";
chrome.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

try {
  await waitForChrome(port);
  const results = [];
  for (const viewport of viewports) {
    results.push(await captureViewport(viewport));
  }
  const failures = results.filter((result) => {
    return (
      result.state?.canvasCount !== 1 ||
      result.imageStats?.coloredRatio < 0.02 ||
      result.consoleErrors.length > 0
    );
  });
  const summaryPath = join(outDir, "summary.json");
  await writeFile(summaryPath, JSON.stringify({ baseUrl, results, failures, stderr: stderr.slice(-4000) }, null, 2));
  console.log(JSON.stringify({ summaryPath, results, failures }, null, 2));
  if (failures.length > 0) {
    throw new Error(`Visual smoke failed: ${failures.map((failure) => failure.name).join(", ")}`);
  }
} finally {
  chrome.kill();
}

async function waitForChrome(debugPort) {
  const endpoint = `http://127.0.0.1:${debugPort}/json/version`;
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await delay(150);
  }
  throw new Error(`Chrome DevTools did not start on port ${debugPort}`);
}

async function captureViewport(viewport) {
  const tabInfo = await newTab();
  const cdp = await connectCdp(tabInfo.webSocketDebuggerUrl);
  const consoleMessages = [];
  const pageErrors = [];

  cdp.on("Runtime.consoleAPICalled", (event) => {
    consoleMessages.push({
      type: event.type,
      text: event.args?.map((arg) => arg.value ?? arg.description ?? "").join(" "),
    });
  });
  cdp.on("Runtime.exceptionThrown", (event) => {
    pageErrors.push(event.exceptionDetails?.text ?? "exception");
  });
  cdp.on("Log.entryAdded", (event) => {
    if (event.entry?.level === "error") {
      pageErrors.push(`${event.entry.text}${event.entry.url ? ` (${event.entry.url})` : ""}`);
    }
  });

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 760,
  });
  await cdp.send("Page.navigate", { url: baseUrl });
  await cdp.waitFor("Page.loadEventFired", 10000);
  await delay(2200);

  for (const click of viewport.clicks) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: click.x, y: click.y, button: "none" });
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: click.x, y: click.y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: click.x, y: click.y, button: "left", clickCount: 1 });
    await delay(900);
  }

  const state = await evaluateState(cdp);
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const screenshotPath = join(outDir, `${viewport.name}.png`);
  const png = Buffer.from(screenshot.data, "base64");
  await writeFile(screenshotPath, png);
  const imageStats = pngStats(png);
  await cdp.close();

  return {
    ...viewport,
    screenshotPath,
    state,
    imageStats,
    consoleErrors: pageErrors,
    consoleMessages: consoleMessages.slice(-8),
  };
}

async function newTab() {
  const response = await fetch(`http://127.0.0.1:${port}/json/new`, { method: "PUT" });
  if (!response.ok) throw new Error(`Failed to create tab: ${response.status}`);
  return response.json();
}

async function evaluateState(cdp) {
  const expression = `(() => {
    const canvas = document.querySelector("canvas");
    const rect = canvas ? canvas.getBoundingClientRect() : null;
    const texts = Array.from(document.querySelectorAll("body *"))
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
      .slice(0, 10);
    return {
      title: document.title,
      bodyTextLength: document.body?.innerText?.length ?? 0,
      canvasCount: document.querySelectorAll("canvas").length,
      canvas: rect ? {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        attrWidth: canvas.width,
        attrHeight: canvas.height
      } : null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      texts
    };
  })()`;
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
  return result.result?.value ?? null;
}

function pngStats(buffer) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") {
    return { valid: false };
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === "IHDR") {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
    }
    if (type === "IDAT") idat.push(buffer.subarray(dataStart, dataEnd));
    if (type === "IEND") break;
    offset = dataEnd + 4;
  }
  if (!width || !height || !idat.length) return { valid: false, width, height };
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  let rawOffset = 0;
  let colored = 0;
  let nonWhite = 0;
  let alpha = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const scanline = Buffer.from(raw.subarray(rawOffset, rawOffset + stride));
    rawOffset += stride;
    unfilter(scanline, previous, filter, 4);
    for (let x = 0; x < width; x += 1) {
      const i = x * 4;
      const r = scanline[i];
      const g = scanline[i + 1];
      const b = scanline[i + 2];
      const a = scanline[i + 3];
      if (a > 0) alpha += 1;
      if (!(r > 245 && g > 245 && b > 245)) nonWhite += 1;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 8) colored += 1;
    }
    previous = scanline;
  }
  const total = width * height;
  return {
    valid: true,
    width,
    height,
    nonWhiteRatio: Number((nonWhite / total).toFixed(4)),
    coloredRatio: Number((colored / total).toFixed(4)),
    alphaRatio: Number((alpha / total).toFixed(4)),
  };
}

function unfilter(scanline, previous, filter, bytesPerPixel) {
  if (filter === 0) return;
  for (let i = 0; i < scanline.length; i += 1) {
    const left = i >= bytesPerPixel ? scanline[i - bytesPerPixel] : 0;
    const up = previous[i] ?? 0;
    const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] ?? 0 : 0;
    if (filter === 1) scanline[i] = (scanline[i] + left) & 255;
    else if (filter === 2) scanline[i] = (scanline[i] + up) & 255;
    else if (filter === 3) scanline[i] = (scanline[i] + Math.floor((left + up) / 2)) & 255;
    else if (filter === 4) scanline[i] = (scanline[i] + paeth(left, up, upLeft)) & 255;
  }
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  ws.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolve: ok, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) reject(new Error(payload.error.message));
      else ok(payload.result ?? {});
      return;
    }
    if (payload.method && listeners.has(payload.method)) {
      for (const listener of listeners.get(payload.method)) listener(payload.params ?? {});
    }
  });

  return new Promise((resolveSocket, rejectSocket) => {
    ws.addEventListener("open", () => {
      resolveSocket({
        send(method, params = {}) {
          const id = nextId++;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject });
            setTimeout(() => {
              if (!pending.has(id)) return;
              pending.delete(id);
              reject(new Error(`CDP timeout: ${method}`));
            }, 10000);
          });
        },
        on(method, listener) {
          if (!listeners.has(method)) listeners.set(method, []);
          listeners.get(method).push(listener);
        },
        waitFor(method, timeout = 10000) {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeout);
            const listener = (params) => {
              clearTimeout(timer);
              resolve(params);
            };
            if (!listeners.has(method)) listeners.set(method, []);
            listeners.get(method).push(listener);
          });
        },
        close() {
          ws.close();
        },
      });
    });
    ws.addEventListener("error", () => rejectSocket(new Error("Failed to connect to CDP websocket")));
  });
}
