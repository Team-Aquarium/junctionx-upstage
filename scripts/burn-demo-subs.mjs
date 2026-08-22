import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "demo");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const srt = await readFile(path.join(dir, "narration.srt"), "utf8");

function parseSrt(text) {
  const blocks = text.trim().split(/\n\s*\n/);
  return blocks.map((block) => {
    const lines = block.split("\n");
    const stamp = lines[1] ?? "";
    const [startRaw, endRaw] = stamp.split(" --> ").map((part) => part.trim());
    const toSec = (value) => {
      const [hms, ms] = value.replace(",", ".").split(".");
      const [h, m, s] = hms.split(":").map(Number);
      return h * 3600 + m * 60 + s + Number(`0.${ms ?? "0"}`);
    };
    return {
      start: toSec(startRaw),
      end: toSec(endRaw),
      text: lines.slice(2).join(" "),
    };
  });
}

const cues = parseSrt(srt);
const capDir = path.join(dir, "caps");
await mkdir(capDir, { recursive: true });

for (let i = 0; i < cues.length; i += 1) {
  const htmlPath = path.join(capDir, `${i}.html`);
  await writeFile(
    htmlPath,
    `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:1440px;height:168px;background:transparent;display:flex;align-items:center;justify-content:center}
p{margin:0;padding:6px 20px;max-width:1220px;background:transparent;color:#fff;font:650 26px/1.45 "Apple SD Gothic Neo",sans-serif;text-align:center;text-shadow:0 1px 3px #000,0 0 2px #000}
</style><p>${cues[i].text.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</p>`,
    "utf8",
  );
  const shot = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--default-background-color=00000000",
      "--window-size=1440,168",
      `--screenshot=${path.join(capDir, `${i}.png`)}`,
      `file://${htmlPath}`,
    ],
    { stdio: "inherit" },
  );
  if (shot.status !== 0) {
    throw new Error(`chrome screenshot failed for caption ${i}`);
  }
}

const args = ["-y", "-i", path.join(dir, "moabora-demo-2x.mp4")];
for (let i = 0; i < cues.length; i += 1) {
  args.push("-i", path.join(capDir, `${i}.png`));
}
args.push("-i", path.join(dir, "narration.wav"));

const filters = ["[0:v]tpad=stop_mode=clone:stop_duration=6[vpad]"];
let last = "[vpad]";
for (let i = 0; i < cues.length; i += 1) {
  const src = `[${i + 1}:v]`;
  const scaled = `[s${i}]`;
  const out = i === cues.length - 1 ? "[vout]" : `[v${i}]`;
  filters.push(`${src}format=rgba,scale=1440:168${scaled}`);
  filters.push(
    `${last}${scaled}overlay=0:732:format=auto:enable='between(t,${cues[i].start.toFixed(3)},${cues[i].end.toFixed(3)})'${out}`,
  );
  last = out;
}

const audioIndex = cues.length + 1;
args.push(
  "-filter_complex",
  filters.join(";"),
  "-map",
  "[vout]",
  "-map",
  `${audioIndex}:a`,
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-movflags",
  "+faststart",
  path.join(dir, "moabora-demo.mp4"),
);

const mux = spawnSync("ffmpeg", args, { stdio: "inherit" });
if (mux.status !== 0) {
  throw new Error("ffmpeg overlay mux failed");
}
console.log(path.join(dir, "moabora-demo.mp4"));
