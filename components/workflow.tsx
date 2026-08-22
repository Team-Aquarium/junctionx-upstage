"use client";

import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  XCircleIcon,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { featureFromStepTitle, UPSTAGE_FEATURES } from "@/components/upstage";
import { Spinner } from "@/components/ui/spinner";
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

function PayloadView({ payload }: { payload: unknown }) {
  const text =
    typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/60 p-3 font-mono text-[11px] leading-relaxed">
      {text}
    </pre>
  );
}

export function WorkflowLog({
  steps,
  className,
}: {
  steps: WorkflowStep[];
  className?: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (steps.length === 0) {
    return null;
  }

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className={cn("space-y-1", className)}>
      {steps.map((step) => {
        const hasPayload = step.payload !== undefined && step.payload !== null;
        const open = expanded.has(step.id);
        const feature = featureFromStepTitle(step.title);
        return (
          <div className="rounded-lg border bg-background" key={step.id}>
            <button
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                hasPayload && "hover:bg-muted/50",
              )}
              disabled={!hasPayload}
              onClick={() => toggle(step.id)}
              type="button"
            >
              <span className="shrink-0">
                {step.status === "start" ? (
                  <Spinner className="size-3.5 text-primary" />
                ) : step.status === "done" ? (
                  <CheckCircle2Icon className="size-3.5 text-primary" />
                ) : (
                  <XCircleIcon className="size-3.5 text-destructive" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">{step.title}</span>
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
              {step.detail && (
                <span className="shrink-0 text-muted-foreground text-xs">{step.detail}</span>
              )}
              {hasPayload &&
                (open ? (
                  <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                ))}
            </button>
            {hasPayload && open && (
              <div className="border-t px-3 py-2">
                <PayloadView payload={step.payload} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
