"use client";

import {
  CheckCircle2Icon,
  FileUpIcon,
  UploadCloudIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  AnnouncementCard,
  type AnnouncementWithMatch,
} from "@/components/announcement";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.bmp,.tif,.tiff,.heic,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.hwp,.hwpx,.html";

type ItemStatus = "대기" | "처리 중" | "완료" | "실패";

interface QueueItem {
  file: File;
  status: ItemStatus;
  error?: string;
  announcement?: AnnouncementWithMatch;
}

const PIPELINE = ["Parse", "Classify", "Extract", "Instruct"] as const;

export default function IngestPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const items = [...files].map((file) => ({ file, status: "대기" as ItemStatus }));
    setQueue((prev) => [...prev, ...items]);
  };

  const updateItem = (index: number, patch: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const run = async () => {
    setRunning(true);
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === "완료") {
        continue;
      }
      updateItem(i, { status: "처리 중", error: undefined });
      try {
        const form = new FormData();
        form.append("file", queue[i].file);
        const res = await fetch("/api/ingest", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          updateItem(i, { status: "실패", error: data.error ?? `HTTP ${res.status}` });
          continue;
        }
        updateItem(i, { status: "완료", announcement: data.announcement });
      } catch (error) {
        updateItem(i, {
          status: "실패",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    setRunning(false);
  };

  const doneItems = queue.filter((item) => item.announcement);
  const pendingCount = queue.filter((item) => item.status === "대기" || item.status === "실패").length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="font-bold text-2xl tracking-tight">공고 등록</h1>
      <p className="mt-1 text-muted-foreground text-sm">
        공고문 PDF·포스터 이미지·HWP를 올리면 Studio 에이전트(Parse → Classify → Extract →
        Instruct)가 구조화된 공고 카드로 만들어 줍니다.
      </p>

      <input
        accept={ACCEPT}
        className="hidden"
        multiple
        onChange={(e) => {
          if (e.target.files?.length) {
            addFiles(e.target.files);
          }
          e.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />

      <button
        className={cn(
          "mt-6 flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
        )}
        onClick={() => inputRef.current?.click()}
        onDragLeave={() => setDragOver(false)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) {
            addFiles(e.dataTransfer.files);
          }
        }}
        type="button"
      >
        <UploadCloudIcon className="size-8 text-primary" />
        <div>
          <p className="font-medium text-sm">공고문을 끌어다 놓거나 클릭해서 선택</p>
          <p className="mt-1 text-muted-foreground text-xs">
            PDF · 이미지 · 오피스 · HWP · HTML — 여러 개 한 번에 가능
          </p>
        </div>
      </button>

      {queue.length > 0 && (
        <div className="mt-4 space-y-2">
          {queue.map((item, index) => (
            <div
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
              key={`${item.file.name}-${index}`}
            >
              <FileUpIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">{item.file.name}</p>
                {item.status === "처리 중" && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground text-xs">
                    {PIPELINE.join(" → ")} 실행 중… (약 30초~2분)
                  </p>
                )}
                {item.status === "실패" && (
                  <p className="mt-0.5 break-words text-destructive text-xs">{item.error}</p>
                )}
                {item.announcement && (
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    {item.announcement.category} · {item.announcement.title}
                  </p>
                )}
              </div>
              <span className="shrink-0">
                {item.status === "대기" && (
                  <span className="text-muted-foreground text-xs">대기</span>
                )}
                {item.status === "처리 중" && <Spinner className="size-4 text-primary" />}
                {item.status === "완료" && (
                  <CheckCircle2Icon className="size-4.5 text-primary" />
                )}
                {item.status === "실패" && (
                  <XCircleIcon className="size-4.5 text-destructive" />
                )}
              </span>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-1">
            <Button disabled={running || pendingCount === 0} onClick={run}>
              {running ? (
                <>
                  <Spinner className="size-4" />
                  에이전트 실행 중…
                </>
              ) : (
                `에이전트로 분석 (${pendingCount}건)`
              )}
            </Button>
            <Button
              disabled={running}
              onClick={() => setQueue([])}
              variant="ghost"
            >
              비우기
            </Button>
          </div>
        </div>
      )}

      {doneItems.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">생성된 공고 카드</h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/">피드에서 보기</Link>
            </Button>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {doneItems.map(
              (item) =>
                item.announcement && (
                  <AnnouncementCard item={item.announcement} key={item.announcement.id} />
                ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
