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
