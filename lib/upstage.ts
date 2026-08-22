import { createHash } from "node:crypto";

const API_BASE = "https://api.upstage.ai";

function getApiKey(): string {
  const key = process.env.UPSTAGE_API_KEY;
  if (!key) {
    throw new Error("UPSTAGE_API_KEY 환경변수가 설정되지 않았습니다. (.env.local 확인)");
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
      throw new Error(`문서 ${doc.id}의 data URL 형식이 올바르지 않습니다.`);
    }
    return Buffer.from(doc.url.slice(base64Index + "base64,".length), "base64");
  }
  const res = await fetch(doc.url);
  if (!res.ok) {
    throw new Error(`문서 ${doc.id} 다운로드 실패 (${res.status})`);
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
    throw new Error(`Document Parse 실패 (${res.status}): ${await res.text()}`);
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
    throw new Error(`Information Extract 실패 (${res.status}): ${await res.text()}`);
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
    throw new Error(`파일 업로드 실패 (${res.status}): ${await res.text()}`);
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
    throw new Error(`에이전트 실행 실패 (${createRes.status}): ${await createRes.text()}`);
  }

  let job = await createRes.json();
  const deadline = Date.now() + timeoutMs;
  while ((job.status === "queued" || job.status === "in_progress") && Date.now() < deadline) {
    await sleep(2500);
    const pollRes = await fetch(`${API_BASE}/v2/responses/${job.id}?include[]=last`, {
      headers: { Authorization: `Bearer ${getApiKey()}` },
    });
    if (!pollRes.ok) {
      throw new Error(`에이전트 상태 조회 실패 (${pollRes.status}): ${await pollRes.text()}`);
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

/** include 없이 실행해 모든 스텝의 출력을 수집한다. (공고 인제스트 파이프라인용) */
export async function runStudioAgentDetailed(
  docs: StoredDocument[],
  agentId: string,
  timeoutMs = 300_000,
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
    throw new Error(`에이전트 실행 실패 (${createRes.status}): ${await createRes.text()}`);
  }

  let job = await createRes.json();
  const deadline = Date.now() + timeoutMs;
  while ((job.status === "queued" || job.status === "in_progress") && Date.now() < deadline) {
    await sleep(2500);
    const pollRes = await fetch(`${API_BASE}/v2/responses/${job.id}`, {
      headers: { Authorization: `Bearer ${getApiKey()}` },
    });
    if (!pollRes.ok) {
      throw new Error(`에이전트 상태 조회 실패 (${pollRes.status}): ${await pollRes.text()}`);
    }
    job = await pollRes.json();
  }

  type OutputContent = { type: string; text?: string };
  type OutputItem = { type: string; model?: string; content?: OutputContent[] };
  const steps: StudioStepOutput[] = ((job.output ?? []) as OutputItem[])
    .filter((item) => item.type === "message")
    .map((item) => ({
      model: item.model ?? "unknown",
      text: (item.content ?? [])
        .filter((content) => content.type === "output_text" && content.text)
        .map((content) => content.text)
        .join("\n"),
    }))
    .filter((step) => step.text.length > 0);

  return {
    status: job.status,
    steps,
    outputText: steps.at(-1)?.text ?? "",
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
// Solar 텍스트 기반 프로필 추출 (개인 링크 → HTML 텍스트 → JSON)
// ---------------------------------------------------------------------------

export async function extractProfileFromText(text: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.UPSTAGE_CHAT_MODEL ?? "solar-pro4",
      messages: [
        {
          role: "system",
          content:
            '주어진 웹페이지 텍스트에서 페이지 주인의 프로필을 추출해 JSON 객체 하나만 출력한다. 설명이나 코드블록 없이 순수 JSON만 출력한다. 스키마: {"name":문자열|null,"university":문자열|null,"department":문자열|null,"grade":숫자|null,"enrollment_status":"재학"|"휴학"|"졸업"|null,"birth_year":숫자|null,"interests":[관심 분야 키워드],"skills":[기술 스택·역량 키워드],"activities":[수상·프로젝트·활동 이력 요약]} 값이 없으면 null 또는 빈 배열. 키워드는 한국어로, 각 배열은 최대 10개.',
        },
        { role: "user", content: text.slice(0, 12_000) },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`프로필 추출 실패 (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "{}";
  return parseAgentJson(content) ?? {};
}
