// 워크플로우 진행 상황을 NDJSON 스트림으로 흘려보내기 위한 공용 타입·서버 헬퍼.
// 이벤트 한 줄 = JSON 하나. 같은 id의 step 이벤트는 클라이언트에서 갱신(업데이트)된다.

export interface WorkflowStepEvent {
  type: "step";
  id: string;
  title: string;
  status: "start" | "done" | "error";
  /** 제목 옆에 붙는 짧은 부가 정보 (예: "12.4s", "HTTP 200") */
  detail?: string;
  /** 펼쳐 볼 수 있는 중간 산출물 (JSON 또는 텍스트) */
  payload?: unknown;
}

export interface WorkflowResultEvent {
  type: "result";
  data: unknown;
}

export interface WorkflowErrorEvent {
  type: "error";
  message: string;
}

export type WorkflowEvent = WorkflowStepEvent | WorkflowResultEvent | WorkflowErrorEvent;

export type WorkflowEmit = (event: WorkflowEvent) => void;

/** 라우트 핸들러에서 NDJSON 스트림 Response를 만든다. handler 안에서 emit으로 이벤트를 보낸다. */
export function workflowStream(
  handler: (emit: WorkflowEmit) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit: WorkflowEmit = (event) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // 클라이언트가 먼저 끊은 경우 무시
        }
      };
      try {
        await handler(emit);
      } catch (error) {
        emit({
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        try {
          controller.close();
        } catch {
          // 이미 닫힘
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

/** 긴 텍스트 payload를 자른다 (스트림 비대 방지). */
export function clip(text: string, max = 4000): string {
  return text.length > max ? `${text.slice(0, max)}\n… (${text.length - max}자 생략)` : text;
}
