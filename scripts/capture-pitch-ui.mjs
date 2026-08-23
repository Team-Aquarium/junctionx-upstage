import { spawn } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = 9334;
const ORIGIN = process.env.PITCH_ORIGIN ?? "http://127.0.0.1:3000";

const PAGES = [
  ["feed", `${ORIGIN}/feed?demo=1`],
  ["ingest", `${ORIGIN}/ingest?demo=1`],
  ["me", `${ORIGIN}/me?demo=1`],
  ["notice", `${ORIGIN}/notice/demo-hero-notice`],
  ["chat", `${ORIGIN}/chat?demo=1`],
];

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(Object.assign(new Error(msg.error.message), msg.error));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function waitFor(fn, timeout = 25000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try {
      last = await fn();
      if (last) return last;
    } catch (err) {
      last = err instanceof Error ? err.message : err;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`timeout: ${last}`);
}

async function connectBrowser() {
  return waitFor(async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (!res.ok) return null;
    return res.json();
  });
}

async function screenshot(browser, url, dest) {
  const browserWs = new WebSocket(browser.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    browserWs.addEventListener("open", resolve);
    browserWs.addEventListener("error", reject);
  });
  const browserCdp = new CDP(browserWs);
  const { targetId } = await browserCdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browserCdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });

  const send = (method, params = {}) =>
    browserCdp.send(method, params).catch((err) => {
      throw err;
    });

  // Flattened sessions use sessionId on the envelope — use a session wrapper.
  const session = {
    send(method, params = {}) {
      const id = ++browserCdp.id;
      return new Promise((resolve, reject) => {
        browserCdp.pending.set(id, { resolve, reject });
        browserWs.send(JSON.stringify({ id, method, params, sessionId }));
      });
    },
  };

  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1280,
    screenHeight: 720,
  });
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: "dark" }],
  });
  await session.send("Page.navigate", { url });

  try {
    await waitFor(async () => {
      const { result } = await session.send("Runtime.evaluate", {
        expression: `({
          dark: document.documentElement.classList.contains("dark"),
          ready: document.body?.dataset?.pitchReady,
          demo: document.body?.dataset?.pitchDemo,
          text: document.body?.innerText?.replace(/\\s+/g, " ").slice(0, 800)
        })`,
        returnByValue: true,
      });
      const state = result.value;
      if (
        state?.dark &&
        (state?.ready === "1" ||
          /JunctionX Korea|Sumin Kim|Eligible|students on leave|Studio agent pipeline/.test(
            state?.text ?? "",
          ))
      ) {
        return true;
      }
      session._last = state;
      return false;
    });
  } catch (err) {
    throw new Error(`${err.message} last=${JSON.stringify(session._last)}`);
  }

  await session.send("Runtime.evaluate", {
    expression: "window.scrollTo(0,0); document.documentElement.scrollTop=0; document.body.scrollTop=0;",
  });
  await new Promise((r) => setTimeout(r, 400));
  const { data } = await session.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 0, width: 1280, height: 720, scale: 2 },
  });
  const { writeFile } = await import("node:fs/promises");
  await writeFile(dest, Buffer.from(data, "base64"));
  await browserCdp.send("Target.closeTarget", { targetId }).catch(() => {});
  browserWs.close();
}

const userData = `/tmp/moabora-pitch-ui-${Date.now()}`;
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userData}`,
    "--window-size=1280,720",
    "--force-device-scale-factor=1",
    "--remote-allow-origins=*",
    "about:blank",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
chrome.stderr.on("data", (chunk) => process.stderr.write(chunk));

try {
  const browser = await connectBrowser();
  await mkdir(path.join(ROOT, "slides/assets"), { recursive: true });
  await mkdir(path.join(ROOT, "public/upstage"), { recursive: true });

  for (const [name, url] of PAGES) {
    const dest = path.join(ROOT, "slides/assets", `ui-${name}.png`);
    process.stdout.write(`capturing ${name}… `);
    await screenshot(browser, url, dest);
    await copyFile(dest, path.join(ROOT, "public/upstage", `ui-${name}.png`));
    console.log("ok");
  }
} finally {
  chrome.kill("SIGTERM");
}
