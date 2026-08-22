// 서버 메모리 워크플로우 세션 허브.
// 실행 중인 워크플로우의 이벤트를 버퍼에 쌓아두고, 클라이언트가 새로고침해도
// 같은 키로 재접속하면 지금까지의 이벤트를 재생한 뒤 라이브로 이어서 스트리밍한다.
// 같은 키의 중복 실행도 자연스럽게 방지된다 (실행 중이면 attach).

import type { WorkflowEmit, WorkflowEvent } from "./workflow";

interface SessionListener {
  onEvent: (event: WorkflowEvent) => void;
  onDone: () => void;
}

interface WorkflowSession {
  key: string;
  events: WorkflowEvent[];
  listeners: Set<SessionListener>;
  done: boolean;
  startedAt: number;
}

/** dev 서버의 모듈 리로드에도 세션이 유지되도록 globalThis에 보관한다. */
const globalStore = globalThis as unknown as {
  __workflowSessions?: Map<string, WorkflowSession>;
};
const sessions: Map<string, WorkflowSession> = (globalStore.__workflowSessions ??= new Map());

/** 완료된 세션을 잠시 보관해 완료 직후 attach도 재생할 수 있게 한다. */
const SESSION_TTL_AFTER_DONE_MS = 60_000;

export function listActiveSessionKeys(): string[] {
  return [...sessions.values()]
    .filter((session) => !session.done)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((session) => session.key);
}

export function getSession(key: string): WorkflowSession | null {
  return sessions.get(key) ?? null;
}

/** 세션의 과거 이벤트를 재생하고 종료까지 라이브 구독하는 NDJSON 스트림 응답. */
export function sessionResponse(session: WorkflowSession): Response {
  const encoder = new TextEncoder();
  let listener: SessionListener | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: WorkflowEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // 클라이언트가 끊은 경우
        }
      };
      for (const event of session.events) {
        send(event);
      }
      if (session.done) {
        try {
          controller.close();
        } catch {
          // 이미 닫힘
        }
        return;
      }
      listener = {
        onEvent: send,
        onDone: () => {
          try {
            controller.close();
          } catch {
            // 이미 닫힘
          }
        },
      };
      session.listeners.add(listener);
    },
    cancel() {
      if (listener) {
        session.listeners.delete(listener);
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

/**
 * 키가 같은 세션이 실행 중이면 그 세션에 접속(이어보기)하고,
 * 아니면 새 세션을 만들어 runner를 백그라운드로 실행한다.
 * runner는 요청이 끊겨도 끝까지 실행된다.
 */
export function runWorkflowSession(
  key: string,
  runner: (emit: WorkflowEmit) => Promise<void>,
): Response {
  const existing = sessions.get(key);
  if (existing && !existing.done) {
    return sessionResponse(existing);
  }

  const session: WorkflowSession = {
    key,
    events: [],
    listeners: new Set(),
    done: false,
    startedAt: Date.now(),
  };
  sessions.set(key, session);

  const emit: WorkflowEmit = (event) => {
    session.events.push(event);
    for (const l of session.listeners) {
      l.onEvent(event);
    }
  };

  (async () => {
    try {
      await runner(emit);
    } catch (error) {
      emit({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      session.done = true;
      for (const l of session.listeners) {
        l.onDone();
      }
      session.listeners.clear();
      setTimeout(() => {
        if (sessions.get(key) === session) {
          sessions.delete(key);
        }
      }, SESSION_TTL_AFTER_DONE_MS);
    }
  })();

  return sessionResponse(session);
}
