import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "demo");
const edge = "/tmp/moabora-tts/bin/edge-tts";
const voice = process.env.DEMO_TTS_VOICE ?? "ko-KR-SunHiNeural";

const LINES = {
  landing:
    "모아보라입니다. 공고문을 읽지 않아도, 지원할 수 있는지 바로 알려줍니다.",
  pipeline:
    "스튜디오 에이전트가 파스, 분류, 추출, 인스트럭트 네 단계로 공고를 구조화합니다.",
  profile:
    "프로필은 링크, 서류, 소개 글 세 갈래입니다. 지금 깃허브에서 관심사와 기술을 뽑고 있습니다.",
  profileFile:
    "재학증명서를 올리면 정보 추출이 이름, 학년, 학적을 채웁니다.",
  profileNote:
    "짧은 소개를 적으면 솔라가 관심사와 역량을 보완합니다. 추론 로그를 함께 보세요.",
  ingestFile:
    "공고 피디에프를 올리면 스튜디오 에이전트가 실시간으로 돌아갑니다.",
  ingestLink:
    "링크만 붙여도 같은 파이프라인이 실행됩니다.",
  ingestCrawl: "콘테스트코리아에서 실공고를 한 건 수집합니다.",
  feed:
    "피드입니다. 솔라가 프로필과 공고를 대조하는 동안 추천 과정을 보고, 점수가 나올 때까지 기다립니다.",
  notice:
    "상세에서 자격 판정 사유를 본 뒤, 문서 챗으로 원문을 가져갑니다.",
  chat:
    "원문이 첨부된 채 질문하면 솔라가 파스와 추출 도구를 직접 호출합니다.",
  end: "에이전트가 요강을 읽습니다. 당신은 지원만 하면 됩니다.",
};

function probeDuration(file) {
  const out = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );
  return Number.parseFloat(out.stdout.trim());
}

function srtTime(seconds) {
  const clamped = Math.max(0, seconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.floor((clamped % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

const markers = JSON.parse(
  await (await import("node:fs/promises")).readFile(path.join(dir, "markers.json"), "utf8"),
);
const video2x = path.join(dir, "moabora-demo-2x.mp4");
const videoDur = probeDuration(video2x);
const lastMark = markers.at(-1)?.t ?? videoDur * 2;
const clockEnd = lastMark + 2.8;
const voDir = path.join(dir, "vo");
await mkdir(voDir, { recursive: true });

const cues = [];
let cursor = 0;
for (const mark of markers) {
  const line = LINES[mark.id] ?? mark.line;
  if (!line) {
    continue;
  }
  const mp3 = path.join(voDir, `${mark.id}.mp3`);
  const wav = path.join(voDir, `${mark.id}.wav`);
  const spoken = spawnSync(
    edge,
    ["--voice", voice, "--rate", "-8%", "--text", line, "--write-media", mp3],
    { stdio: "inherit" },
  );
  if (spoken.status !== 0) {
    throw new Error(`edge-tts failed for ${mark.id}`);
  }
  const conv = spawnSync(
    "ffmpeg",
    ["-y", "-i", mp3, "-ar", "44100", "-ac", "1", wav],
    { stdio: "inherit" },
  );
  if (conv.status !== 0) {
    throw new Error(`wav convert failed for ${mark.id}`);
  }
  const speech = probeDuration(wav);
  const sceneStart = (mark.t / clockEnd) * videoDur;
  const start = Math.max(sceneStart, cursor);
  const end = start + speech;
  cursor = end + 0.16;
  cues.push({ id: mark.id, line, start, end, wav, delayMs: Math.round(start * 1000) });
  console.log(
    `${mark.id}: scene ${sceneStart.toFixed(2)}s → vo ${start.toFixed(2)}–${end.toFixed(2)}s (${speech.toFixed(2)}s)`,
  );
}

const srt = cues
  .map((cue, i) => `${i + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.line}\n`)
  .join("\n");
await writeFile(path.join(dir, "narration.srt"), `${srt}\n`);

const mixInputs = [];
const delays = [];
for (const [index, cue] of cues.entries()) {
  mixInputs.push("-i", cue.wav);
  delays.push(`[${index}]adelay=${cue.delayMs}|${cue.delayMs}[a${index}]`);
}
const mix = [
  ...delays,
  `${cues.map((_, i) => `[a${i}]`).join("")}amix=inputs=${cues.length}:normalize=0:duration=longest[aout]`,
].join(";");
const outDur = Math.max(videoDur + 6, cursor);
const narration = path.join(dir, "narration.wav");
const mixed = spawnSync(
  "ffmpeg",
  [
    "-y",
    ...mixInputs,
    "-filter_complex",
    `${mix};[aout]apad=whole_dur=${outDur.toFixed(3)}[apad]`,
    "-map",
    "[apad]",
    "-t",
    String(outDur),
    narration,
  ],
  { stdio: "inherit" },
);
if (mixed.status !== 0) {
  throw new Error("ffmpeg failed to mix delayed narration");
}

const burned = spawnSync("node", [path.join(root, "scripts/burn-demo-subs.mjs")], {
  stdio: "inherit",
});
if (burned.status !== 0) {
  throw new Error("subtitle burn failed");
}
console.log(path.join(dir, "moabora-demo.mp4"));
