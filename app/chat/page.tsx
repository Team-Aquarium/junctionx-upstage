"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  isStaticToolUIPart,
  type FileUIPart,
  type UIMessage,
} from "ai";
import {
  BrainIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  PaperclipIcon,
  PlusIcon,
  RefreshCcwIcon,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationDownload,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageActions,
  MessageAction,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { UpstageBadge } from "@/components/upstage";
import { Button } from "@/components/ui/button";
import { useI18n, useT } from "@/lib/i18n/client";
import { createPitchDemoChat, markPitchDemoReady, pitchDemoBoot } from "@/lib/pitch-demo";

const ACCEPT_FORMATS =
  ".pdf,.png,.jpg,.jpeg,.bmp,.tif,.tiff,.heic,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.hwp,.hwpx,.html,.htm";

const SUGGESTION_KEYS = [
  "chat.suggestion1",
  "chat.suggestion2",
  "chat.suggestion3",
] as const;

const FEATURES = [
  {
    icon: "/upstage/document-parse.svg",
    title: "Document Parse",
    descKey: "chat.parseDesc",
  },
  {
    icon: "/upstage/information-extract.svg",
    title: "Information Extract",
    descKey: "chat.extractDesc",
  },
  {
    icon: "/upstage/studio-agents.svg",
    title: "Studio Agents",
    descKey: "chat.agentsDesc",
  },
] as const;

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}

function InputAttachments() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) {
    return null;
  }
  return (
    <PromptInputHeader>
      <Attachments variant="inline">
        {attachments.files.map((file) => (
          <Attachment
            data={file}
            key={file.id}
            onRemove={() => attachments.remove(file.id)}
          >
            <AttachmentPreview />
            <AttachmentInfo />
            <AttachmentRemove />
          </Attachment>
        ))}
      </Attachments>
    </PromptInputHeader>
  );
}

function AttachButton() {
  const t = useT();
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton
      aria-label={t("chat.attach")}
      onClick={attachments.openFileDialog}
      type="button"
    >
      <PaperclipIcon className="size-4 text-muted-foreground" />
      <span className="max-sm:hidden text-xs">{t("chat.attach")}</span>
    </PromptInputButton>
  );
}

async function toSendableFiles(
  files: (FileUIPart & { id: string })[],
): Promise<FileUIPart[]> {
  return Promise.all(
    files.map(async ({ id: _id, ...item }) => {
      if (!item.url?.startsWith("blob:")) {
        return item;
      }
      try {
        const response = await fetch(item.url);
        const blob = await response.blob();
        const dataUrl = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
        return { ...item, url: dataUrl ?? item.url };
      } catch {
        return item;
      }
    }),
  );
}

function filenameFromDisposition(header: string | null, fallback: string) {
  if (!header) {
    return fallback;
  }
  const utf8 = /filename\*=(?:UTF-8''|utf-8'')([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      return utf8[1].trim();
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) {
    return quoted[1];
  }
  const bare = /filename=([^;]+)/i.exec(header);
  if (bare?.[1]) {
    return bare[1].trim().replace(/^["']|["']$/g, "");
  }
  return fallback;
}

const MEDIA_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "text/html": ".html",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

function withExtension(name: string, mediaType: string) {
  if (name.includes(".")) {
    return name;
  }
  return `${name}${MEDIA_EXT[mediaType] ?? ""}`;
}

async function fetchNoticeFile(noticeId: string, signal: AbortSignal) {
  const res = await fetch(`/api/files/${noticeId}`, { signal });
  if (!res.ok) {
    throw new Error("missing");
  }
  const blob = await res.blob();
  const name = withExtension(
    filenameFromDisposition(res.headers.get("Content-Disposition"), `notice-${noticeId}`),
    blob.type,
  );
  return new File([blob], name, { type: blob.type || "application/octet-stream" });
}

function SeedNoticeFile({ file }: { file: File }) {
  const { add, files } = usePromptInputAttachments();
  const seededKey = useRef<string | null>(null);
  const key = `${file.name}:${file.size}:${file.type}`;

  useEffect(() => {
    if (seededKey.current === key) {
      return;
    }
    if (files.some((item) => item.filename === file.name)) {
      seededKey.current = key;
      return;
    }
    seededKey.current = key;
    add([file]);
  }, [add, file, files, key]);

  return null;
}

function PromptSuggestions({
  onSend,
}: {
  onSend: (text: string, files: FileUIPart[]) => void;
}) {
  const t = useT();
  const attachments = usePromptInputAttachments();
  const suggestions = SUGGESTION_KEYS.map((key) => t(key));

  return (
    <Suggestions className="mb-3">
      {suggestions.map((suggestion) => (
        <Suggestion
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:border-primary/50 transition-colors"
          key={suggestion}
          onClick={async (text) => {
            const files = await toSendableFiles(attachments.files);
            onSend(text, files);
            attachments.clear();
          }}
          suggestion={suggestion}
        />
      ))}
    </Suggestions>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const { t, locale, setLocale } = useI18n();
  const searchParams = useSearchParams();
  const initialInput = searchParams.get("q") ?? "";
  const noticeId = searchParams.get("notice");
  const boot = pitchDemoBoot(searchParams.get("demo") === "1");
  const { messages, sendMessage, status, stop, regenerate, setMessages, error, clearError } =
    useChat({
      transport: new DefaultChatTransport({ api: "/api/chat" }),
      messages: boot?.messages,
    });
  const [fileError, setFileError] = useState<string | null>(null);
  const [noticeFile, setNoticeFile] = useState<File | null>(null);
  const [noticeAttach, setNoticeAttach] = useState<"idle" | "loading" | "ready" | "error">(
    noticeId ? "loading" : "idle",
  );

  useEffect(() => {
    if (!noticeId) {
      setNoticeFile(null);
      setNoticeAttach("idle");
      return;
    }

    const ac = new AbortController();
    setNoticeFile(null);
    setNoticeAttach("loading");

    fetchNoticeFile(noticeId, ac.signal)
      .then((file) => {
        setNoticeFile(file);
        setNoticeAttach("ready");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setNoticeFile(null);
        setNoticeAttach("error");
      });

    return () => ac.abort();
  }, [noticeId]);
  const [reasoningEffort, setReasoningEffort] = useState<string>("high");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!boot) {
      return;
    }
    if (locale !== "en") {
      setLocale("en");
      return;
    }
    setMessages(createPitchDemoChat(t));
    markPitchDemoReady();
  }, [boot, locale, setLocale, setMessages, t]);

  const requestBody = { reasoningEffort };
  const isBusy = status === "submitted" || status === "streaming";

  const toolTitles: Record<string, string> = {
    "tool-parse_document": t("chat.toolParse"),
    "tool-extract_information": t("chat.toolExtract"),
    "tool-run_studio_agent": t("chat.toolAgent"),
  };

  const reasoningOptions = [
    { value: "off", label: t("chat.reasoningOff") },
    { value: "low", label: t("chat.reasoningLow") },
    { value: "medium", label: t("chat.reasoningMedium") },
    { value: "high", label: t("chat.reasoningHigh") },
  ] as const;

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text && message.files.length === 0) {
      return;
    }
    setFileError(null);
    sendMessage(
      { text: text || t("chat.defaultPrompt"), files: message.files },
      { body: requestBody },
    );
  };

  const handleNewChat = () => {
    stop();
    clearError();
    setMessages([]);
    setFileError(null);
  };

  const handleCopy = async (message: UIMessage) => {
    await navigator.clipboard.writeText(getMessageText(message));
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <PromptInputProvider initialInput={initialInput}>
      {noticeFile && <SeedNoticeFile file={noticeFile} />}
      <div className="flex h-[calc(100dvh-4rem)] flex-col bg-background">
        {messages.length > 0 && (
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 pt-3 pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground">{t("chat.title")}</span>
              <UpstageBadge compact feature="solar" />
            </div>
            <div className="flex items-center gap-1">
              <ConversationDownload
                aria-label={t("chat.export")}
                className="size-7 rounded-md hover:bg-muted"
                filename="moabora-chat.md"
                messages={messages}
                size="icon-sm"
                variant="ghost"
              >
                <DownloadIcon className="size-3.5 text-muted-foreground" />
              </ConversationDownload>
              <Button
                aria-label={t("chat.newChat")}
                className="size-7 rounded-md hover:bg-muted"
                onClick={handleNewChat}
                size="icon-sm"
                variant="ghost"
              >
                <PlusIcon className="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        )}

        <Conversation className="flex-1">
          <ConversationContent className="mx-auto w-full max-w-4xl px-6 py-8">
            {messages.length === 0 ? (
              <div className="flex min-h-[45dvh] flex-col items-center justify-center gap-8 text-center">
                <div className="space-y-1.5 max-w-md">
                  <h2 className="font-bold text-2xl text-foreground tracking-tight">
                    {t("chat.emptyTitle")}
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("chat.emptyBody")}
                  </p>
                </div>

                <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
                  {FEATURES.map((feature) => (
                    <div
                      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center"
                      key={feature.title}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={feature.title}
                        className="size-7 object-contain"
                        height={28}
                        src={feature.icon}
                        width={28}
                      />
                      <span className="font-semibold text-xs text-foreground">{feature.title}</span>
                      <span className="text-[11px] text-muted-foreground leading-relaxed">
                        {t(feature.descKey)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, messageIndex) => {
                const isLastMessage = messageIndex === messages.length - 1;
                const showActions =
                  message.role === "assistant" && !(isBusy && isLastMessage);

                return (
                  <Message from={message.role} key={message.id}>
                    <MessageContent>
                      {message.parts.map((part, index) => {
                        const key = `${message.id}-${index}`;

                        if (part.type === "text") {
                          return message.role === "assistant" ? (
                            <MessageResponse key={key}>
                              {part.text}
                            </MessageResponse>
                          ) : (
                            <span key={key}>{part.text}</span>
                          );
                        }

                        if (part.type === "reasoning") {
                          return (
                            <Reasoning
                              isStreaming={part.state === "streaming"}
                              key={key}
                            >
                              <ReasoningTrigger
                                getThinkingMessage={(isStreaming, duration) =>
                                  isStreaming ? (
                                    <Shimmer duration={1}>{t("chat.reasoning")}</Shimmer>
                                  ) : (
                                    <p>
                                      {duration
                                        ? t("chat.reasoned", { n: duration })
                                        : t("chat.reasonedDone")}
                                    </p>
                                  )
                                }
                              />
                              <ReasoningContent>{part.text}</ReasoningContent>
                            </Reasoning>
                          );
                        }

                        if (part.type === "file") {
                          return (
                            <Attachments key={key} variant="inline">
                              <Attachment data={{ ...part, id: key }}>
                                <AttachmentPreview />
                                <AttachmentInfo />
                              </Attachment>
                            </Attachments>
                          );
                        }

                        if (isStaticToolUIPart(part)) {
                          return (
                            <Tool key={part.toolCallId}>
                              <ToolHeader
                                state={part.state}
                                title={toolTitles[part.type]}
                                type={part.type}
                              />
                              <ToolContent>
                                <ToolInput input={part.input} />
                                <ToolOutput
                                  errorText={part.errorText}
                                  output={part.output}
                                />
                              </ToolContent>
                            </Tool>
                          );
                        }

                        return null;
                      })}
                    </MessageContent>
                    {showActions && (
                      <MessageActions>
                        <MessageAction
                          onClick={() => handleCopy(message)}
                          tooltip={t("chat.copy")}
                        >
                          {copiedId === message.id ? (
                            <CheckIcon className="size-3.5 text-primary" />
                          ) : (
                            <CopyIcon className="size-3.5" />
                          )}
                        </MessageAction>
                        {isLastMessage && (
                          <MessageAction
                            onClick={() => regenerate({ body: requestBody })}
                            tooltip={t("chat.regenerate")}
                          >
                            <RefreshCcwIcon className="size-3.5" />
                          </MessageAction>
                        )}
                      </MessageActions>
                    )}
                  </Message>
                );
              })
            )}
            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer>{t("chat.thinking")}</Shimmer>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Input Area */}
        <div className="mx-auto w-full max-w-4xl px-6 pb-6">
          {error && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
              <span>{t("chat.error", { message: error.message })}</span>
              <Button
                onClick={() => regenerate({ body: requestBody })}
                size="xs"
                variant="outline"
              >
                {t("chat.retry")}
              </Button>
            </div>
          )}

          {messages.length === 0 && (
            <PromptSuggestions
              onSend={(text, files) =>
                sendMessage({ text, files }, { body: requestBody })
              }
            />
          )}

          <PromptInput
            accept={ACCEPT_FORMATS}
            globalDrop
            maxFileSize={50 * 1024 * 1024}
            maxFiles={5}
            multiple
            onError={(err) =>
              setFileError(
                err.code === "accept"
                  ? t("chat.unsupportedType")
                  : err.code === "max_file_size"
                    ? t("chat.tooLarge")
                    : t("chat.tooMany"),
              )
            }
            onSubmit={handleSubmit}
          >
            <InputAttachments />
            <PromptInputBody>
              <PromptInputTextarea
                className="text-xs placeholder:text-muted-foreground"
                placeholder={t("chat.placeholder")}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <AttachButton />
                <PromptInputSelect
                  onValueChange={setReasoningEffort}
                  value={reasoningEffort}
                >
                  <PromptInputSelectTrigger
                    aria-label={t("chat.reasoningLevel")}
                    className="h-7 gap-1 rounded-md border-border text-xs text-muted-foreground"
                  >
                    <BrainIcon className="size-3.5" />
                    <PromptInputSelectValue />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent className="rounded-lg border border-border">
                    {reasoningOptions.map((option) => (
                      <PromptInputSelectItem
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              </PromptInputTools>
              <PromptInputSubmit onStop={stop} status={status} />
            </PromptInputFooter>
          </PromptInput>

          <p className="mt-2 text-center text-muted-foreground text-[11px]">
            {fileError
              ?? (noticeAttach === "loading" ? t("chat.attachingNotice") : null)
              ?? (noticeAttach === "error" ? t("chat.attachNoticeFailed") : null)
              ?? t("chat.footer")}
          </p>
        </div>
      </div>
    </PromptInputProvider>
  );
}
