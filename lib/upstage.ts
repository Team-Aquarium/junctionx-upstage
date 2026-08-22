import { createHash } from "node:crypto";

const API_BASE = "https://api.upstage.ai";

function getApiKey(): string {
  const key = process.env.UPSTAGE_API_KEY;
  if (!key) {
    throw new Error("UPSTAGE_API_KEY is not set. Check .env.local.");
  }
  return key;
}

/** 채팅 메시지에 첨부된 문서 파일 (data URL 형태로 전달됨) */
export interface StoredDocument {
  id: string;
  filename: string;
  mediaType: string;
  url: string;
}

async function getDocumentBytes(doc: StoredDocument): Promise<Buffer> {
  if (doc.url.startsWith("data:")) {
    const base64Index = doc.url.indexOf("base64,");
    if (base64Index === -1) {
      throw new Error(`Document ${doc.id} has an invalid data URL.`);
    }
    return Buffer.from(doc.url.slice(base64Index + "base64,".length), "base64");
  }
  const res = await fetch(doc.url);
  if (!res.ok) {
    throw new Error(`Failed to download document ${doc.id} (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Document Parse (POST /v1/document-digitization)
// ---------------------------------------------------------------------------

export interface ParseResult {
  markdown: string;
  pages: number;
  model: string;
}

/** 같은 파일을 다시 파싱하면 재과금되므로 프로세스 메모리에 결과를 캐시한다. */
const parseCache = new Map<string, ParseResult>();

export async function parseDocument(
  doc: StoredDocument,
  mode?: "standard" | "enhanced" | "auto",
): Promise<ParseResult> {
  const bytes = await getDocumentBytes(doc);
  const cacheKey = `${createHash("sha256").update(bytes).digest("hex")}:${mode ?? "default"}`;
  const cached = parseCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const form = new FormData();
  form.append("document", new Blob([new Uint8Array(bytes)], { type: doc.mediaType }), doc.filename);
  form.append("model", "document-parse");
  form.append("output_formats", JSON.stringify(["markdown"]));
  form.append("ocr", "auto");
  if (mode) {
    form.append("mode", mode);
  }

  const res = await fetch(`${API_BASE}/v1/document-digitization`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getApiKey()}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Document Parse failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const result: ParseResult = {
    markdown: data.content?.markdown ?? data.content?.text ?? "",
    pages: data.usage?.pages ?? 0,
    model: data.model ?? "document-parse",
  };
  parseCache.set(cacheKey, result);
  return result;
}

// ---------------------------------------------------------------------------
// Universal Information Extraction (POST /v1/information-extraction/chat/completions)
// ---------------------------------------------------------------------------

export interface ExtractResult {
  extracted: unknown;
  model: string;
}

export async function extractInformation(
  doc: StoredDocument,
  schemaName: string,
  properties: Record<string, unknown>,
): Promise<ExtractResult> {
  const bytes = await getDocumentBytes(doc);

  const res = await fetch(`${API_BASE}/v1/information-extraction/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "information-extract",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:application/octet-stream;base64,${bytes.toString("base64")}`,
              },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          schema: { type: "object", properties },
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Information Extract failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  let extracted: unknown;
  try {
    extracted = JSON.parse(content);
  } catch {
    extracted = content;
  }
  return { extracted, model: data.model ?? "information-extract" };
}

// ---------------------------------------------------------------------------
// Studio Agents API (POST /v2/files → POST /v2/responses → 폴링)
// ---------------------------------------------------------------------------

export interface StudioAgentResult {
  status: string;
  outputText: string;
  error?: unknown;
}

async function uploadFile(doc: StoredDocument): Promise<string> {
  const bytes = await getDocumentBytes(doc);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: doc.mediaType }), doc.filename);
  form.append("purpose", "user_data");

  const res = await fetch(`${API_BASE}/v2/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getApiKey()}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`File upload failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()).id as string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runStudioAgent(
  docs: StoredDocument[],
  agentId: string,
  timeoutMs = 240_000,
): Promise<StudioAgentResult> {
  const fileIds: string[] = [];
  for (const doc of docs) {
    fileIds.push(await uploadFile(doc));
  }

  const createRes = await fetch(`${API_BASE}/v2/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: agentId,
      include: ["last"],
      input: [
        {
          role: "user",
          content: fileIds.map((fileId) => ({ type: "input_file", file_id: fileId })),
        },
      ],
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Agent run failed (${createRes.status}): ${await createRes.text()}`);
  }

  let job = await createRes.json();
  const deadline = Date.now() + timeoutMs;
  while ((job.status === "queued" || job.status === "in_progress") && Date.now() < deadline) {
    await sleep(2500);
    const pollRes = await fetch(`${API_BASE}/v2/responses/${job.id}?include[]=last`, {
      headers: { Authorization: `Bearer ${getApiKey()}` },
    });
    if (!pollRes.ok) {
      throw new Error(`Agent status poll failed (${pollRes.status}): ${await pollRes.text()}`);
    }
    job = await pollRes.json();
  }

  type OutputContent = { type: string; text?: string };
  type OutputItem = { type: string; content?: OutputContent[] };
  const outputText = ((job.output ?? []) as OutputItem[])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && content.text)
    .map((content) => content.text)
    .join("\n");

  return { status: job.status, outputText, error: job.error ?? undefined };
}

export interface StudioStepOutput {
  model: string;
  text: string;
}

export interface StudioAgentDetailedResult {
  status: string;
  steps: StudioStepOutput[];
  /** 마지막 스텝(보통 Instruct)의 출력 텍스트 */
  outputText: string;
  error?: unknown;
}

export interface StudioPollSnapshot {
  status: string;
  elapsedMs: number;
  steps: StudioStepOutput[];
  jobId: string;
}

/** include 없이 실행해 모든 스텝의 출력을 수집한다. (공고 인제스트 파이프라인용) */
export async function runStudioAgentDetailed(
  docs: StoredDocument[],
  agentId: string,
  timeoutMs = 300_000,
  onProgress?: (snapshot: StudioPollSnapshot) => void,
): Promise<StudioAgentDetailedResult> {
  const fileIds: string[] = [];
  for (const doc of docs) {
    fileIds.push(await uploadFile(doc));
  }

  const createRes = await fetch(`${API_BASE}/v2/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: agentId,
      input: [
        {
          role: "user",
          content: fileIds.map((fileId) => ({ type: "input_file", file_id: fileId })),
        },
      ],
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Agent run failed (${createRes.status}): ${await createRes.text()}`);
  }

  type OutputContent = { type: string; text?: string };
  type OutputItem = { type: string; model?: string; content?: OutputContent[] };
  const collectSteps = (output: unknown): StudioStepOutput[] =>
    ((output ?? []) as OutputItem[])
      .filter((item) => item.type === "message")
      .map((item) => ({
        model: item.model ?? "unknown",
        text: (item.content ?? [])
          .filter((content) => content.type === "output_text" && content.text)
          .map((content) => content.text)
          .join("\n"),
      }))
      .filter((step) => step.text.length > 0);

  // 폴링 응답마다 output에 담기는 메시지 집합이 달라질 수 있어(중간엔 개별 노드,
  // 완료 시점엔 마지막 메시지만) 스냅샷을 누적해 전체 노드 출력을 보존한다.
  const accumulated = new Map<string, string>();
  const accumulate = (output: unknown): StudioStepOutput[] => {
    for (const step of collectSteps(output)) {
      accumulated.set(step.model, step.text);
    }
    return [...accumulated.entries()].map(([model, text]) => ({ model, text }));
  };

  let job = await createRes.json();
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  onProgress?.({
    status: job.status,
    elapsedMs: 0,
    steps: accumulate(job.output),
    jobId: job.id,
  });

  while ((job.status === "queued" || job.status === "in_progress") && Date.now() < deadline) {
    await sleep(2500);
    const pollRes = await fetch(`${API_BASE}/v2/responses/${job.id}`, {
      headers: { Authorization: `Bearer ${getApiKey()}` },
    });
    if (!pollRes.ok) {
      throw new Error(`Agent status poll failed (${pollRes.status}): ${await pollRes.text()}`);
    }
    job = await pollRes.json();
    onProgress?.({
      status: job.status,
      elapsedMs: Date.now() - startedAt,
      steps: accumulate(job.output),
      jobId: job.id,
    });
  }

  const steps = accumulate(job.output);
  // 최종 산출물은 Instruct 노드 출력을 우선 사용하고, 없으면 마지막 노드를 쓴다.
  const instructStep = steps.filter((step) => /instruct/i.test(step.model)).at(-1);
  return {
    status: job.status,
    steps,
    outputText: instructStep?.text ?? steps.at(-1)?.text ?? "",
    error: job.error ?? undefined,
  };
}

/**
 * 에이전트 Instruct 출력에서 JSON 객체를 파싱한다.
 * 출력이 JSON 문자열로 이중 인코딩되어 오는 경우("\"{...}\"")까지 처리한다.
 */
export function parseAgentJson(text: string): Record<string, unknown> | null {
  let current = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    // 인용 마커(【†1】)가 JSON 구조 사이에 끼면 파싱이 깨지므로 미리 제거한다.
    .replace(/【†\d+】/g, "")
    .trim();

  for (let i = 0; i < 4; i++) {
    try {
      const parsed: unknown = JSON.parse(current);
      if (typeof parsed === "string") {
        current = parsed;
        continue;
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      const start = current.indexOf("{");
      const end = current.lastIndexOf("}");
      if (start >= 0 && end > start) {
        const sliced = current.slice(start, end + 1);
        if (sliced === current) {
          return null;
        }
        current = sliced;
        continue;
      }
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Solar 스트리밍 호출 (추론 델타를 실시간 콜백으로 전달)
// ---------------------------------------------------------------------------

async function solarChatStream(
  messages: { role: string; content: string }[],
  onReasoning?: (accumulated: string) => void,
): Promise<{ content: string; reasoning: string | null }> {
  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.UPSTAGE_CHAT_MODEL ?? "solar-pro4",
      reasoning_effort: "low",
      stream: true,
      messages,
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Solar request failed (${res.status}): ${await res.text()}`);
  }

  let content = "";
  let reasoning = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") {
        continue;
      }
      try {
        const chunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta ?? {};
        if (typeof delta.reasoning === "string" && delta.reasoning) {
          reasoning += delta.reasoning;
          onReasoning?.(reasoning);
        }
        if (typeof delta.content === "string" && delta.content) {
          content += delta.content;
        }
      } catch {
        // 잘린 청크는 무시
      }
    }
  }
  return { content, reasoning: reasoning.trim() || null };
}

// ---------------------------------------------------------------------------
// Solar 기반 공고 추천 (프로필 × 공고 목록 → 적합도 점수 + 추천 이유)
// ---------------------------------------------------------------------------

export interface RecommendationItem {
  id: string;
  score: number;
  reason: string;
}

export async function recommendAnnouncements(
  profile: Record<string, unknown>,
  announcements: {
    id: string;
    category: string;
    title: string;
    field: string | null;
    benefits: string | null;
    summary: string[];
  }[],
  onReasoning?: (accumulated: string) => void,
  locale: "en" | "ko" = "en",
): Promise<{ items: RecommendationItem[]; reasoning: string | null }> {
  const systemPrompt =
    locale === "ko"
      ? '당신은 대학생에게 공고(공모전·해커톤·장학금·대외활동·채용)를 추천하는 어시스턴트입니다. 사용자 프로필과 공고 목록이 JSON으로 주어집니다. 각 공고의 적합도를 평가해 아래 JSON 객체 하나만 출력하세요. 설명이나 코드블록 없이 순수 JSON만 출력합니다.\n{"recommendations":[{"id":"공고 id","score":0~100 정수,"reason":"프로필의 구체적 요소(관심사·기술·활동)와 공고 내용을 연결한 한국어 한 문장 (60자 이내)"}]}\n규칙: 모든 공고를 score 내림차순으로 포함. 프로필과 실제 접점이 있는 요소만 근거로 쓰고, 접점이 없으면 score를 40 미만으로 주고 reason에 그 사실을 솔직하게 적으세요.'
      : 'You recommend contests, hackathons, scholarships, activities, and jobs to university students. The user profile and notice list are given as JSON. Score each notice and output only the JSON object below — no explanation or code fences.\n{"recommendations":[{"id":"notice id","score":0-100 integer,"reason":"one English sentence (max 80 chars) linking a concrete profile element (interest, skill, or activity) to the notice"}]}\nRules: include every notice, sorted by score descending. Use only real overlap as evidence. If there is no overlap, score below 40 and say so honestly. Write every reason in English.';
  const { content, reasoning } = await solarChatStream(
    [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: JSON.stringify({ profile, announcements }),
      },
    ],
    onReasoning,
  );
  const parsed = parseAgentJson(content);
  const list = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
  const items = list
    .filter(
      (item): item is { id: string; score: number; reason: string } =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).id === "string" &&
        typeof (item as Record<string, unknown>).reason === "string",
    )
    .map((item) => ({
      id: item.id,
      score: Math.max(0, Math.min(100, Math.round(Number(item.score) || 0))),
      reason: item.reason.trim(),
    }));
  return { items, reasoning };
}

// ---------------------------------------------------------------------------
// Solar 텍스트 기반 프로필 추출 (개인 링크 → HTML 텍스트 → JSON)
// ---------------------------------------------------------------------------

export async function extractProfileFromText(
  text: string,
  onReasoning?: (accumulated: string) => void,
): Promise<{ extracted: Record<string, unknown>; reasoning: string | null }> {
  const { content, reasoning } = await solarChatStream(
    [
      {
        role: "system",
        content:
          '주어진 웹페이지 텍스트에서 페이지 주인의 프로필을 추출해 JSON 객체 하나만 출력한다. 설명이나 코드블록 없이 순수 JSON만 출력한다. 스키마: {"name":문자열|null,"university":문자열|null,"department":문자열|null,"grade":숫자|null,"enrollment_status":"재학"|"휴학"|"졸업"|null,"birth_year":숫자|null,"interests":[관심 분야 키워드],"skills":[기술 스택·역량 키워드],"activities":[수상·프로젝트·활동 이력 요약]} 값이 없으면 null 또는 빈 배열. 키워드는 한국어로, 각 배열은 최대 10개.',
      },
      { role: "user", content: text.slice(0, 12_000) },
    ],
    onReasoning,
  );
  return { extracted: parseAgentJson(content || "{}") ?? {}, reasoning };
}
