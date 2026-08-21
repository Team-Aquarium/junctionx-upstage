import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  extractInformation,
  parseDocument,
  runStudioAgent,
  type StoredDocument,
} from "@/lib/upstage";

export const maxDuration = 300;

const MAX_PARSE_OUTPUT_CHARS = 40_000;

const SYSTEM_PROMPT = `당신은 Upstage Document AI 위에서 동작하는 문서 에이전트입니다.

사용자가 첨부한 문서는 대화에 [첨부 문서] docId="doc-1" 형태의 마커로 표시됩니다.
문서의 실제 내용은 당신에게 직접 주어지지 않으므로, 반드시 도구를 호출해서 접근해야 합니다.

도구 사용 지침:
- parse_document: 문서 내용을 읽어야 하는 모든 작업(요약, 질의응답, 번역, 분류 등)의 첫 단계로 호출합니다. 문서 전체가 마크다운으로 변환됩니다.
- extract_information: 특정 필드를 구조화된 JSON으로 추출할 때 사용합니다. 사용자 요청에 맞는 JSON Schema properties를 직접 설계해서 전달하세요. 필드마다 명확한 영문 snake_case 키와 상세한 description을 작성해야 정확도가 올라갑니다.
- run_studio_agent: Upstage Studio에서 만든 에이전트 파이프라인(Parse→Classify→Extract→Instruct)을 실행합니다. 사용자가 Studio 에이전트 실행을 요청하거나 agt_로 시작하는 에이전트 ID를 제공한 경우에 사용합니다.

규칙:
- 도구가 필요하면 계획을 텍스트나 JSON으로 서술하지 말고 즉시 실제 tool call을 실행하세요. 실행 여부가 불확실한 경우에도 일단 호출하면 오류 메시지로 상황을 알 수 있습니다.
- 이전 턴에서 이미 파싱한 문서의 내용이 대화에 남아 있으면 재호출하지 말고 그 결과를 재사용하세요.
- 도구 결과에 근거해서만 답하고, 문서에 없는 내용은 추측하지 마세요.
- 도구가 오류를 반환하면 원인을 설명하고 가능한 대안을 제시하세요.
- 최종 답변은 한국어로, 읽기 좋은 마크다운으로 작성하세요.`;

/**
 * UIMessage의 file 파트를 서버측 문서 레지스트리로 옮기고,
 * 모델에게는 docId 마커 텍스트만 전달한다. (Solar 챗 API는 파일 입력 미지원)
 */
function collectDocuments(messages: UIMessage[]): {
  docs: StoredDocument[];
  transformed: UIMessage[];
} {
  const docs: StoredDocument[] = [];
  const transformed = messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (part.type !== "file") {
        return part;
      }
      const id = `doc-${docs.length + 1}`;
      const filename = part.filename ?? `${id}`;
      docs.push({ id, filename, mediaType: part.mediaType, url: part.url });
      return {
        type: "text" as const,
        text: `[첨부 문서] docId="${id}" filename="${filename}" mediaType="${part.mediaType}"`,
      };
    }),
  }));
  return { docs, transformed };
}

const REASONING_EFFORTS = ["low", "medium", "high"] as const;

export async function POST(req: Request) {
  const {
    messages,
    reasoningEffort,
  }: { messages: UIMessage[]; reasoningEffort?: string } = await req.json();
  const { docs, transformed } = collectDocuments(messages);

  const effort = REASONING_EFFORTS.find((value) => value === reasoningEffort);

  const upstage = createOpenAICompatible({
    name: "upstage",
    baseURL: "https://api.upstage.ai/v1",
    apiKey: process.env.UPSTAGE_API_KEY ?? "",
  });

  const findDoc = (docId: string) => docs.find((doc) => doc.id === docId);
  const missingDocError = (docId: string) => ({
    error: `docId "${docId}"에 해당하는 첨부 문서가 없습니다. 현재 첨부된 문서: ${
      docs.length > 0 ? docs.map((doc) => `${doc.id} (${doc.filename})`).join(", ") : "없음"
    }`,
  });

  const result = streamText({
    model: upstage(process.env.UPSTAGE_CHAT_MODEL ?? "solar-pro4"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(transformed),
    stopWhen: stepCountIs(8),
    ...(effort
      ? { providerOptions: { upstage: { reasoningEffort: effort } } }
      : {}),
    tools: {
      parse_document: tool({
        description:
          "Upstage Document Parse로 첨부 문서(PDF, 이미지, 오피스 문서 등)를 마크다운 텍스트로 변환합니다. 문서 내용을 읽어야 하는 모든 작업의 첫 단계입니다.",
        inputSchema: z.object({
          docId: z.string().describe('처리할 문서의 ID (예: "doc-1")'),
          mode: z
            .enum(["standard", "enhanced", "auto"])
            .optional()
            .describe(
              "파싱 모드. 기본은 standard. 복잡한 표/차트/손글씨가 많으면 enhanced, 페이지별 자동 선택은 auto.",
            ),
        }),
        execute: async ({ docId, mode }) => {
          const doc = findDoc(docId);
          if (!doc) {
            return missingDocError(docId);
          }
          try {
            const parsed = await parseDocument(doc, mode);
            const truncated = parsed.markdown.length > MAX_PARSE_OUTPUT_CHARS;
            return {
              docId,
              filename: doc.filename,
              model: parsed.model,
              pages: parsed.pages,
              truncated,
              markdown: truncated
                ? `${parsed.markdown.slice(0, MAX_PARSE_OUTPUT_CHARS)}\n\n...(길이 제한으로 뒷부분 생략)`
                : parsed.markdown,
            };
          } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
          }
        },
      }),

      extract_information: tool({
        description:
          "Upstage Universal Information Extraction으로 첨부 문서에서 구조화된 필드를 JSON으로 추출합니다. 추출할 필드는 JSON Schema properties 형식으로 정의합니다.",
        inputSchema: z.object({
          docId: z.string().describe('처리할 문서의 ID (예: "doc-1")'),
          schemaName: z
            .string()
            .regex(/^[a-zA-Z0-9_-]{1,64}$/)
            .describe("스키마 이름 (영숫자/언더스코어/대시, 64자 이하. 예: contract_schema)"),
          properties: z
            .union([z.record(z.string(), z.any()), z.string()])
            .describe(
              'JSON Schema의 properties 객체. 예: {"company_name": {"type": "string", "description": "The name of the company issuing the document"}, "total_amount": {"type": "number", "description": "Total amount in KRW"}}. 배열은 {"type": "array", "items": {...}} 형태로 정의.',
            ),
        }),
        execute: async ({ docId, schemaName, properties }) => {
          const doc = findDoc(docId);
          if (!doc) {
            return missingDocError(docId);
          }
          let parsedProperties: Record<string, unknown>;
          if (typeof properties === "string") {
            try {
              parsedProperties = JSON.parse(properties);
            } catch {
              return { error: "properties가 올바른 JSON이 아닙니다. JSON Schema properties 객체를 전달하세요." };
            }
          } else {
            parsedProperties = properties;
          }
          try {
            const result = await extractInformation(doc, schemaName, parsedProperties);
            return { docId, filename: doc.filename, model: result.model, extracted: result.extracted };
          } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
          }
        },
      }),

      run_studio_agent: tool({
        description:
          "Upstage Studio에서 만든 문서 에이전트(Parse→Classify→Extract→Instruct 파이프라인)를 실행합니다. 파일 업로드 후 작업이 끝날 때까지 폴링하며, 몇 분까지 걸릴 수 있습니다.",
        inputSchema: z.object({
          docIds: z.array(z.string()).min(1).describe('처리할 문서 ID 목록 (예: ["doc-1"])'),
          agentId: z
            .string()
            .startsWith("agt_")
            .optional()
            .describe(
              "실행할 Studio 에이전트 ID. 사용자가 대화에서 직접 제공한 경우에만 전달하고, 절대 임의의 값을 지어내지 마세요. 생략하면 서버에 설정된 UPSTAGE_AGENT_ID를 사용합니다.",
            ),
        }),
        execute: async ({ docIds, agentId }) => {
          const resolvedAgentId = agentId ?? process.env.UPSTAGE_AGENT_ID;
          if (!resolvedAgentId) {
            return {
              error:
                "Studio 에이전트 ID가 없습니다. studio.upstage.ai에서 에이전트를 만들고 .env.local에 UPSTAGE_AGENT_ID를 설정하거나, 채팅으로 agt_로 시작하는 ID를 알려달라고 사용자에게 요청하세요.",
            };
          }
          const targets: StoredDocument[] = [];
          for (const docId of docIds) {
            const doc = findDoc(docId);
            if (!doc) {
              return missingDocError(docId);
            }
            targets.push(doc);
          }
          try {
            const run = await runStudioAgent(targets, resolvedAgentId);
            return { agentId: resolvedAgentId, ...run };
          } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    onError: (error) =>
      error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.",
  });
}
