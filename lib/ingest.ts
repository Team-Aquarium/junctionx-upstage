import {
  parseAgentJson,
  runStudioAgentDetailed,
  type StoredDocument,
} from "@/lib/upstage";
import {
  saveAnnouncement,
  saveUploadFile,
  type Announcement,
  type EligibilityRules,
} from "@/lib/store";
import { clip, type WorkflowEmit } from "@/lib/workflow";

/** Instruct 출력에 섞여 오는 인용 마커(【†1】)를 제거한다. */
function clean(value: string): string {
  return value.replace(/【†\d+】/g, "").trim();
}

function str(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const cleaned = clean(value);
  return cleaned && cleaned.toLowerCase() !== "null" ? cleaned : null;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === "string")
        .map(clean)
        .filter((v) => v.length > 0)
    : [];
}

function toRules(value: unknown): EligibilityRules {
  if (!value || typeof value !== "object") {
    return {};
  }
  const raw = value as Record<string, unknown>;
  const numArray = (v: unknown) =>
    Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    grades: numArray(raw.grades),
    status: Array.isArray(raw.status) ? strArray(raw.status) : null,
    min_age: num(raw.min_age),
    max_age: num(raw.max_age),
    majors: Array.isArray(raw.majors) ? strArray(raw.majors) : null,
    team_size: str(raw.team_size),
    region: str(raw.region),
    etc: str(raw.etc),
  };
}

export interface IngestSource {
  filename: string;
  mediaType: string;
  bytes: Buffer;
  /** 크롤링으로 수집한 경우 원문 페이지 URL */
  sourceUrl?: string | null;
}

/**
 * 문서(공고문)를 Studio 공고 에이전트에 태워 Announcement로 저장한다.
 * emit이 주어지면 파이프라인 단계·중간 산출물을 워크플로우 이벤트로 흘려보낸다.
 * 실패 시 Error를 throw한다.
 */
export async function ingestAnnouncementDocument(
  source: IngestSource,
  emit?: WorkflowEmit,
): Promise<Announcement> {
  const agentId = process.env.UPSTAGE_AGENT_ID;
  if (!agentId) {
    throw new Error("UPSTAGE_AGENT_ID가 설정되지 않았습니다. (.env.local 확인)");
  }

  const id = crypto.randomUUID().slice(0, 8);
  const doc: StoredDocument = {
    id,
    filename: source.filename,
    mediaType: source.mediaType,
    url: `data:${source.mediaType};base64,${source.bytes.toString("base64")}`,
  };

  const agentStepId = `agent-${id}`;
  const agentTitle = "Studio 에이전트 실행 (Parse → Classify → Extract → Instruct)";
  emit?.({
    type: "step",
    id: agentStepId,
    title: agentTitle,
    status: "start",
    detail: "파일 업로드 중",
  });

  const seenNodes = new Set<string>();
  const emitNodes = (steps: { model: string; text: string }[]) => {
    for (const node of steps) {
      if (seenNodes.has(node.model)) {
        continue;
      }
      seenNodes.add(node.model);
      emit?.({
        type: "step",
        id: `node-${id}-${node.model}`,
        title: `노드 출력 — ${node.model}`,
        status: "done",
        payload: clip(node.text),
      });
    }
  };

  const run = await runStudioAgentDetailed([doc], agentId, 300_000, (snapshot) => {
    emit?.({
      type: "step",
      id: agentStepId,
      title: agentTitle,
      status: "start",
      detail: `${snapshot.status} · ${Math.round(snapshot.elapsedMs / 1000)}초`,
      payload: { job_id: snapshot.jobId, agent_id: agentId },
    });
    emitNodes(snapshot.steps);
  });
  if (run.status !== "completed") {
    emit?.({ type: "step", id: agentStepId, title: agentTitle, status: "error", detail: run.status });
    throw new Error(`에이전트 실행이 완료되지 않았습니다 (status: ${run.status})`);
  }
  emitNodes(run.steps);
  emit?.({
    type: "step",
    id: agentStepId,
    title: agentTitle,
    status: "done",
    detail: `노드 출력 ${run.steps.length}개`,
  });

  const parsed = parseAgentJson(run.outputText);
  if (!parsed) {
    emit?.({
      type: "step",
      id: `parse-${id}`,
      title: "출력 JSON 파싱",
      status: "error",
      payload: clip(run.outputText, 2000),
    });
    throw new Error("에이전트 출력을 JSON으로 해석하지 못했습니다.");
  }
  emit?.({
    type: "step",
    id: `parse-${id}`,
    title: "출력 JSON 파싱 (이중 인코딩·인용 마커 정리)",
    status: "done",
    payload: parsed,
  });

  const announcement: Announcement = {
    id,
    category: str(parsed.category) ?? "others",
    title: str(parsed.title) ?? source.filename,
    organizer: str(parsed.organizer),
    field: str(parsed.field),
    apply_start: str(parsed.apply_start),
    apply_end: str(parsed.apply_end),
    result_date: str(parsed.result_date),
    benefits: str(parsed.benefits),
    contact: str(parsed.contact),
    apply_url: str(parsed.apply_url),
    summary: strArray(parsed.summary),
    rules: toRules(parsed.rules),
    todo_checklist: strArray(parsed.todo_checklist),
    sourceFile: { name: source.filename, mediaType: source.mediaType },
    sourceUrl: source.sourceUrl ?? null,
    createdAt: new Date().toISOString(),
  };

  saveUploadFile(id, source.bytes);
  saveAnnouncement(announcement);
  emit?.({
    type: "step",
    id: `save-${id}`,
    title: "공고 카드 저장",
    status: "done",
    detail: `${announcement.category} · ${announcement.title.slice(0, 30)}`,
  });
  return announcement;
}
