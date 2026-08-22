// 공고 에이전트 실제 실행 테스트: 출력 JSON 구조를 확인하기 위한 1회성 스크립트
// 사용법: node scripts/test-agent.mjs [파일경로]
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
);

const API_KEY = env.UPSTAGE_API_KEY;
const AGENT_ID = env.UPSTAGE_AGENT_ID;
const filePath = resolve(process.argv[2] ?? "samples/hackathon-notice.pdf");

console.log(`agent=${AGENT_ID} file=${filePath}`);

// 1. 파일 업로드
const form = new FormData();
form.append("file", new Blob([readFileSync(filePath)], { type: "application/pdf" }), basename(filePath));
form.append("purpose", "user_data");
const fileRes = await fetch("https://api.upstage.ai/v2/files", {
  method: "POST",
  headers: { Authorization: `Bearer ${API_KEY}` },
  body: form,
});
if (!fileRes.ok) throw new Error(`upload ${fileRes.status}: ${await fileRes.text()}`);
const file = await fileRes.json();
console.log("uploaded:", file.id);

// 2. Job 생성 (include 없이 — 전체 output 확인 목적)
const createRes = await fetch("https://api.upstage.ai/v2/responses", {
  method: "POST",
  headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: AGENT_ID,
    input: [{ role: "user", content: [{ type: "input_file", file_id: file.id }] }],
  }),
});
if (!createRes.ok) throw new Error(`create ${createRes.status}: ${await createRes.text()}`);
let job = await createRes.json();
console.log("job:", job.id, job.status);

// 3. 폴링 (최대 10분)
const deadline = Date.now() + 600_000;
while ((job.status === "queued" || job.status === "in_progress") && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 4000));
  const poll = await fetch(`https://api.upstage.ai/v2/responses/${job.id}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!poll.ok) throw new Error(`poll ${poll.status}: ${await poll.text()}`);
  job = await poll.json();
  process.stdout.write(`\rstatus=${job.status} elapsed=${Math.round((Date.now() - (deadline - 600_000)) / 1000)}s   `);
}
console.log("\nfinal status:", job.status);

writeFileSync("samples/agent-response.json", JSON.stringify(job, null, 2));
console.log("saved: samples/agent-response.json");

// include=last 형태도 별도 저장
const lastRes = await fetch(`https://api.upstage.ai/v2/responses/${job.id}?include[]=last`, {
  headers: { Authorization: `Bearer ${API_KEY}` },
});
writeFileSync("samples/agent-response-last.json", JSON.stringify(await lastRes.json(), null, 2));
console.log("saved: samples/agent-response-last.json");
console.log("DONE_TEST_AGENT");
