import { chromium } from "playwright";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "demo");
const samples = path.join(root, "samples");
const base = process.env.DEMO_BASE_URL ?? "http://localhost:3000";

const NARRATION = {
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
  ingestLink: "링크만 붙여도 같은 파이프라인이 실행됩니다.",
  ingestCrawl: "콘테스트코리아에서 실공고를 한 건 수집합니다.",
  feed:
    "피드입니다. 솔라가 프로필과 공고를 대조하는 동안 추천 과정을 보고, 점수가 나올 때까지 기다립니다.",
  notice:
    "상세에서 자격 판정 사유를 본 뒤, 문서 챗으로 원문을 가져갑니다.",
  chat:
    "원문이 첨부된 채 질문하면 솔라가 파스와 추출 도구를 직접 호출합니다.",
  end: "에이전트가 요강을 읽습니다. 당신은 지원만 하면 됩니다.",
};

async function hold(page, ms) {
  await page.waitForTimeout(ms);
}

function headerLink(page, name) {
  return page.locator("header").getByRole("link", { name, exact: true });
}

async function followLog(page) {
  await page.evaluate(() => {
    const cards = [
      ...document.querySelectorAll("div.rounded-xl.border, div.rounded-md.border, form"),
    ];
    const last = cards.at(-1);
    last?.scrollIntoView({ behavior: "smooth", block: "center" });
    for (const el of document.querySelectorAll(".overflow-y-auto, .max-h-60")) {
      el.scrollTop = el.scrollHeight;
    }
  });
}

async function waitWatching(page, check, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    await followLog(page);
    try {
      if (await check()) {
        await followLog(page);
        return true;
      }
    } catch {
      /* still waiting */
    }
    await hold(page, 1400);
  }
  return false;
}

async function pickFreshContestUrl() {
  try {
    const list = await fetch(`${base}/api/announcements`).then((r) => r.json());
    const known = new Set(
      (list.announcements ?? []).map((a) => a.sourceUrl).filter(Boolean),
    );
    const html = await fetch(
      "https://www.contestkorea.com/sub/list.php?int_gbn=1&Txt_bcode=030310001",
      { headers: { "User-Agent": "MoaboraDemo/1.0" } },
    ).then((r) => r.text());
    const matches = [...html.matchAll(/view\.php\?[^"'<\s]*str_no=\d+/gi)];
    for (const match of matches) {
      const url = `https://www.contestkorea.com/sub/${match[0].replace(/&amp;/g, "&")}`;
      if (!known.has(url)) {
        return url;
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

const freshLink = await pickFreshContestUrl();
const markers = [];
const clockStart = Date.now();

function mark(id) {
  const t = (Date.now() - clockStart) / 1000;
  markers.push({ t, id, line: NARRATION[id] });
  console.log(`mark ${id} @ ${t.toFixed(1)}s`);
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
  locale: "en-US",
  recordVideo: { dir: outDir, size: { width: 1440, height: 900 } },
});

await context.addInitScript(() => {
  try {
    localStorage.setItem("theme", "dark");
  } catch {
    /* ignore */
  }
});
await context.addCookies([{ name: "moabora-locale", value: "en", url: base }]);

const page = await context.newPage();
page.setDefaultTimeout(15000);

try {
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await page.emulateMedia({ colorScheme: "dark" });
  mark("landing");
  await hold(page, 3200);
  await page.evaluate(() => window.scrollTo({ top: 780, behavior: "smooth" }));
  await hold(page, 400);
  mark("pipeline");
  await hold(page, 2800);
  await page.evaluate(() => window.scrollTo({ top: 1500, behavior: "smooth" }));
  await hold(page, 2400);

  await headerLink(page, "Profile").click();
  await page.waitForURL("**/me");
  await page.waitForLoadState("networkidle");
  mark("profile");
  await hold(page, 1600);

  const linkBox = page.locator('input[type="url"]').first();
  await linkBox.scrollIntoViewIfNeeded();
  await linkBox.fill("https://github.com/sspzoa");
  await hold(page, 500);
  await page.getByRole("button", { name: "Analyze link" }).click();
  await hold(page, 700);
  await waitWatching(
    page,
    () => page.getByRole("button", { name: "Analyze link" }).isVisible(),
    180000,
  );
  await hold(page, 1200);

  mark("profileFile");
  await page.getByRole("button", { name: "Choose a file" }).scrollIntoViewIfNeeded();
  await page.locator('input[type="file"]').first().setInputFiles(
    path.join(samples, "enrollment-certificate.pdf"),
  );
  await hold(page, 700);
  await waitWatching(
    page,
    () => page.getByRole("button", { name: "Choose a file" }).isVisible(),
    180000,
  );
  await hold(page, 1200);

  mark("profileNote");
  const note = page.locator("textarea").first();
  await note.scrollIntoViewIfNeeded();
  await note.fill(
    "3rd-year Computer Science student. Built two document-AI side projects. Interested in LLM agents, hackathons, and information extraction.",
  );
  await hold(page, 500);
  await page.getByRole("button", { name: "Let Solar complete the rest" }).click();
  await hold(page, 700);
  await waitWatching(
    page,
    () => page.getByRole("button", { name: "Let Solar complete the rest" }).isVisible(),
    180000,
  );
  await hold(page, 1400);

  await headerLink(page, "Add notice").click();
  await page.waitForURL("**/ingest");
  await page.waitForLoadState("networkidle");
  mark("ingestFile");
  await hold(page, 1200);
  await page.locator('input[type="file"]').setInputFiles(
    path.join(samples, "hackathon-notice.pdf"),
  );
  await hold(page, 600);
  await page.getByRole("button", { name: /run agent/i }).click();
  await hold(page, 700);
  await waitWatching(
    page,
    () => page.locator("svg.size-4.text-emerald-600").first().isVisible(),
    300000,
  );
  await hold(page, 1600);

  if (freshLink) {
    mark("ingestLink");
    await page.locator('input[placeholder="https://..."]').fill(freshLink);
    await hold(page, 400);
    await page.getByRole("button", { name: "Register link" }).click();
    await hold(page, 700);
    await waitWatching(
      page,
      () => page.getByRole("button", { name: "Register link" }).isVisible(),
      300000,
    );
    await hold(page, 1400);
  }

  mark("ingestCrawl");
  const countInput = page.locator('input[type="number"]');
  await countInput.scrollIntoViewIfNeeded();
  await countInput.fill("1");
  await page.getByRole("button", { name: "Start collection" }).click();
  await hold(page, 700);
  await waitWatching(
    page,
    () => page.getByRole("button", { name: "Start collection" }).isVisible(),
    360000,
  );
  await hold(page, 1800);

  await headerLink(page, "Feed").click();
  await page.waitForURL("**/feed");
  mark("feed");
  await page
    .getByText(/analyzing your profile and notices|프로필과 공고를/i)
    .waitFor({ timeout: 30000 })
    .catch(() => {});
  const fitCard = page
    .locator('a[href^="/notice/"]')
    .filter({ hasText: /Fit \d+|적합도 \d+/ })
    .first();
  await fitCard.waitFor({ state: "visible", timeout: 360000 });
  await page.evaluate(() => {
    const heading = [...document.querySelectorAll("h2")].find((el) =>
      /recommended|추천/i.test(el.textContent || ""),
    );
    heading?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  await hold(page, 2000);
  const recProcess = page.getByRole("button", { name: /AI recommendation process|추천 과정/i });
  if (await recProcess.count()) {
    await recProcess.first().click();
    await hold(page, 800);
    await followLog(page);
    await hold(page, 2800);
  }
  await hold(page, 2400);

  mark("notice");
  await fitCard.click();
  await page.waitForURL("**/notice/**");
  await page.waitForLoadState("networkidle");
  await hold(page, 1600);
  await page.evaluate(() => window.scrollTo({ top: 420, behavior: "smooth" }));
  await hold(page, 1600);
  await page.evaluate(() => window.scrollTo({ top: 860, behavior: "smooth" }));
  await hold(page, 1600);

  const reviewBtn = page.getByRole("link", { name: /ask document chat about this notice/i });
  const openBtn = page.getByRole("link", { name: /open in document chat/i });
  if (await reviewBtn.count()) {
    await reviewBtn.first().scrollIntoViewIfNeeded();
    await hold(page, 700);
    await reviewBtn.first().click();
  } else {
    await openBtn.first().scrollIntoViewIfNeeded();
    await hold(page, 700);
    await openBtn.first().click();
  }

  await page.waitForURL("**/chat**");
  mark("chat");
  await page
    .getByText(/Attaching the notice document|공고 원문을 첨부하는/i)
    .waitFor({ state: "hidden", timeout: 45000 })
    .catch(() => {});
  await hold(page, 1800);
  await page.locator('form button[aria-label="Submit"]').click();
  await page.getByRole("button", { name: "Stop" }).waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: "Submit" }).waitFor({ timeout: 360000 });
  await hold(page, 4000);

  mark("end");
} catch (error) {
  console.error(error);
  await hold(page, 2000);
}

const video = page.video();
await page.close();
const rawPath = video ? await video.path() : null;
await context.close();
await browser.close();

if (!rawPath) {
  throw new Error("Playwright did not produce a video file");
}

await writeFile(path.join(outDir, "markers.json"), JSON.stringify(markers, null, 2));

const finalPath = path.join(outDir, "moabora-demo.mp4");
const encode = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    rawPath,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    finalPath,
  ],
  { stdio: "inherit" },
);
if (encode.status !== 0) {
  throw new Error("ffmpeg failed to encode the raw demo");
}
await rm(rawPath, { force: true }).catch(() => {});

console.log(finalPath);
