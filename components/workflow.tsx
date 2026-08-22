"use client";

import type { ToolUIPart } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { featureFromStepTitle, UPSTAGE_FEATURES } from "@/components/upstage";
import type { WorkflowEvent } from "@/lib/workflow";
import { cn } from "@/lib/utils";

export interface WorkflowStep {
  id: string;
  title: string;
  status: "start" | "done" | "error";
  detail?: string;
  payload?: unknown;
}

async function consumeStream(
  res: Response,
  onEvent: (event: WorkflowEvent) => void,
): Promise<void> {
  if (!res.body) {
    throw new Error("응답 스트림을 열 수 없습니다.");
  }
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
      if (!line.trim()) {
        continue;
      }
      try {
        onEvent(JSON.parse(line) as WorkflowEvent);
      } catch {
        // 잘린 라인은 무시
      }
    }
  }
}

/** NDJSON 스트림(x-ndjson)이 아닌 일반 JSON 응답인지 판별한다. */
function isPlainJson(res: Response): boolean {
  return res.headers.get("content-type")?.includes("application/json") ?? false;
}

/** 단계 UI 없이 스트림의 최종 result만 필요할 때 쓰는 헬퍼. */
export async function readWorkflowResult<T>(url: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(url, init);
  if (isPlainJson(res)) {
    const data = await res.json().catch(() => null);
    return (data as T) ?? null;
  }
  let result: T | null = null;
  await consumeStream(res, (event) => {
    if (event.type === "result") {
      result = event.data as T;
    }
  });
  return result;
}

export function useWorkflowStream() {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stepsRef = useRef<WorkflowStep[]>([]);
  const errorRef = useRef<string | null>(null);

  const setErrorBoth = useCallback((message: string | null) => {
    errorRef.current = message;
    setError(message);
  }, []);

  const reset = useCallback(() => {
    setSteps([]);
    stepsRef.current = [];
    setErrorBoth(null);
  }, [setErrorBoth]);

  const run = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T | null> => {
    setSteps([]);
    stepsRef.current = [];
    setErrorBoth(null);
    setRunning(true);
    let result: T | null = null;
    try {
      const res = await fetch(url, init);
      if (isPlainJson(res)) {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorBoth((data as { error?: string }).error ?? `HTTP ${res.status}`);
          return null;
        }
        return data as T;
      }
      await consumeStream(res, (event) => {
        if (event.type === "step") {
          setSteps((prev) => {
            const index = prev.findIndex((s) => s.id === event.id);
            const next: WorkflowStep = {
              id: event.id,
              title: event.title,
              status: event.status,
              detail: event.detail,
              payload: event.payload ?? (index >= 0 ? prev[index].payload : undefined),
            };
            const updated =
              index >= 0 ? prev.map((s, i) => (i === index ? next : s)) : [...prev, next];
            stepsRef.current = updated;
            return updated;
          });
        } else if (event.type === "result") {
          result = event.data as T;
        } else if (event.type === "error") {
          setErrorBoth(event.message);
        }
      });
    } catch (err) {
      setErrorBoth(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
    return result;
  }, [setErrorBoth]);

  return { steps, stepsRef, running, error, errorRef, run, reset };
}

/** 워크플로우 단계 상태 → 챗 툴 패널 상태 매핑 */
function toToolState(status: WorkflowStep["status"]): ToolUIPart["state"] {
  if (status === "start") {
    return "input-available";
  }
  if (status === "error") {
    return "output-error";
  }
  return "output-available";
}

function StepTitle({ step }: { step: WorkflowStep }) {
  const feature = featureFromStepTitle(step.title);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {feature && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`Upstage ${UPSTAGE_FEATURES[feature].label}`}
          className="size-4 shrink-0 rounded-full"
          height={16}
          src={UPSTAGE_FEATURES[feature].icon}
          title={`Upstage ${UPSTAGE_FEATURES[feature].label}`}
          width={16}
        />
      )}
      <span className="min-w-0 truncate">{step.title}</span>
      {step.detail && (
        <span className="shrink-0 truncate font-normal text-muted-foreground text-xs">
          · {step.detail}
        </span>
      )}
    </span>
  );
}

/**
 * Solar 추론 단계 — 챗의 Reasoning UI.
 * 스트리밍 중에도 사용자가 접으면 접힌 상태를 유지해야 하므로(컴포넌트 내부의
 * 자동 열림 이펙트가 사용자 조작을 되돌리는 문제) 열림 상태를 밖에서 제어한다.
 */
function ReasoningStep({ step }: { step: WorkflowStep }) {
  const streaming = step.status === "start";
  const text = typeof step.payload === "string" ? step.payload : "";
  const [open, setOpen] = useState(streaming);
  const userToggledRef = useRef(false);
  const wasStreamingRef = useRef(streaming);
  const contentRef = useRef<HTMLDivElement>(null);

  // 스트리밍 시작 시 자동 열기 / 종료 시 자동 접기 — 사용자가 손대기 전까지만
  useEffect(() => {
    if (streaming && !wasStreamingRef.current && !userToggledRef.current) {
      setOpen(true);
    }
    if (!streaming && wasStreamingRef.current && !userToggledRef.current) {
      const timer = setTimeout(() => setOpen(false), 1000);
      wasStreamingRef.current = streaming;
      return () => clearTimeout(timer);
    }
    wasStreamingRef.current = streaming;
  }, [streaming]);

  // 스트리밍 중에는 스크롤을 바닥에 붙여 새 추론이 계속 보이게 한다.
  useEffect(() => {
    if (streaming && open && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streaming, open, text]);

  return (
    <Reasoning
      className="mb-2 rounded-md border px-3 py-2.5"
      defaultOpen={false}
      isStreaming={streaming}
      onOpenChange={(next) => {
        userToggledRef.current = true;
        setOpen(next);
      }}
      open={open}
    >
      <ReasoningTrigger
        getThinkingMessage={(isStreaming, duration) =>
          isStreaming ? (
            <Shimmer duration={1}>추론 중...</Shimmer>
          ) : (
            <p>{duration ? `${duration}초 동안 추론함` : "추론 완료"}</p>
          )
        }
      />
      <ReasoningContent className="max-h-60 overflow-y-auto" ref={contentRef}>
        {text}
      </ReasoningContent>
    </Reasoning>
  );
}

/** 문서 챗과 동일한 AI Elements(Reasoning·Tool)로 워크플로우 단계를 렌더한다. */
export function WorkflowLog({
  steps,
  className,
}: {
  steps: WorkflowStep[];
  className?: string;
}) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-0", className)}>
      {steps.map((step) => {
        if (step.id === "reasoning") {
          return <ReasoningStep key={step.id} step={step} />;
        }

        // 나머지 단계는 챗의 Tool 패널 UI로
        const hasPayload = step.payload !== undefined && step.payload !== null;
        return (
          <Tool className="mb-2" key={step.id}>
            <ToolHeader
              state={toToolState(step.status)}
              title={<StepTitle step={step} />}
              type={`tool-${step.id}`}
            />
            {(hasPayload || step.status === "error") && (
              <ToolContent>
                <ToolOutput
                  errorText={
                    step.status === "error"
                      ? typeof step.payload === "string"
                        ? undefined
                        : (step.detail ?? "단계 실행에 실패했습니다.")
                      : undefined
                  }
                  output={step.payload ?? undefined}
                />
              </ToolContent>
            )}
          </Tool>
        );
      })}
    </div>
  );
}
