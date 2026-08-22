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

const SYSTEM_PROMPT = `You are a document agent running on Upstage Document AI.

Documents the user attaches appear in the conversation as [Attached document] docId="doc-1" markers.
The actual document content is not given to you directly, so you must call tools to access it.

Tool usage:
- parse_document: Call this first for any task that needs to read the document (summary, Q&A, translation, classification, etc.). The full document is converted to markdown.
- extract_information: Use this to extract specific fields as structured JSON. Design JSON Schema properties that match the user's request. Accuracy improves when each field has a clear English snake_case key and a detailed description.
- run_studio_agent: Runs an agent pipeline created in Upstage Studio (Parse→Classify→Extract→Instruct). Use this when the user asks to run a Studio agent or provides an agent ID starting with agt_.

Rules:
- If you need a tool, do not describe the plan in text or JSON — execute the actual tool call immediately. Even if you are unsure, call it; the error message will tell you the situation.
- If a previously parsed document's content is still in the conversation, reuse that result instead of calling again.
- Answer only based on tool results. Do not guess content that is not in the document.
- If a tool returns an error, explain the cause and suggest possible alternatives.
- Write the final answer in the same language the user used, as readable markdown.`;

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
        text: `[Attached document] docId="${id}" filename="${filename}" mediaType="${part.mediaType}"`,
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
    error: `No attached document matches docId "${docId}". Currently attached: ${
      docs.length > 0 ? docs.map((doc) => `${doc.id} (${doc.filename})`).join(", ") : "none"
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
          "Converts an attached document (PDF, image, office document, etc.) to markdown text using Upstage Document Parse. This is the first step for any task that needs to read the document.",
        inputSchema: z.object({
          docId: z.string().describe('ID of the document to process (e.g. "doc-1")'),
          mode: z
            .enum(["standard", "enhanced", "auto"])
            .optional()
            .describe(
              "Parsing mode. Default is standard. Use enhanced for complex tables/charts/handwriting, auto for per-page automatic selection.",
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
                ? `${parsed.markdown.slice(0, MAX_PARSE_OUTPUT_CHARS)}\n\n...(truncated due to length limit)`
                : parsed.markdown,
            };
          } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
          }
        },
      }),

      extract_information: tool({
        description:
          "Extracts structured fields as JSON from an attached document using Upstage Universal Information Extraction. Define the fields as JSON Schema properties.",
        inputSchema: z.object({
          docId: z.string().describe('ID of the document to process (e.g. "doc-1")'),
          schemaName: z
            .string()
            .regex(/^[a-zA-Z0-9_-]{1,64}$/)
            .describe("Schema name (alphanumeric/underscore/dash, 64 characters or fewer. e.g. contract_schema)"),
          properties: z
            .union([z.record(z.string(), z.any()), z.string()])
            .describe(
              'JSON Schema properties object. Example: {"company_name": {"type": "string", "description": "The name of the company issuing the document"}, "total_amount": {"type": "number", "description": "Total amount in KRW"}}. Define arrays as {"type": "array", "items": {...}}.',
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
              return { error: "properties is not valid JSON. Pass a JSON Schema properties object." };
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
          "Runs a document agent created in Upstage Studio (Parse→Classify→Extract→Instruct pipeline). Uploads the file and polls until the job finishes; this can take several minutes.",
        inputSchema: z.object({
          docIds: z.array(z.string()).min(1).describe('List of document IDs to process (e.g. ["doc-1"])'),
          agentId: z
            .string()
            .startsWith("agt_")
            .optional()
            .describe(
              "Studio agent ID to run. Pass this only when the user provided it in the conversation; never invent a value. If omitted, the server uses UPSTAGE_AGENT_ID.",
            ),
        }),
        execute: async ({ docIds, agentId }) => {
          const resolvedAgentId = agentId ?? process.env.UPSTAGE_AGENT_ID;
          if (!resolvedAgentId) {
            return {
              error:
                "No Studio agent ID. Create an agent at studio.upstage.ai and set UPSTAGE_AGENT_ID in .env.local, or ask the user for an ID that starts with agt_.",
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
      error instanceof Error ? error.message : "An error occurred while processing the request.",
  });
}
