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
import { useState } from "react";
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
import { Button } from "@/components/ui/button";

const ACCEPT_FORMATS =
  ".pdf,.png,.jpg,.jpeg,.bmp,.tif,.tiff,.heic,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.hwp,.hwpx";

const SUGGESTIONS = [
  "이 문서를 3줄로 요약해줘",
  "핵심 정보를 JSON으로 추출해줘",
  "이 문서는 어떤 종류의 문서야?",
  "문서에 있는 표를 정리해줘",
];

const TOOL_TITLES: Record<string, string> = {
  "tool-parse_document": "Document Parse — 문서 구조화",
  "tool-extract_information": "Information Extract — 필드 추출",
  "tool-run_studio_agent": "Studio Agent 실행",
};

const REASONING_OPTIONS = [
  { value: "off", label: "추론 끄기" },
  { value: "low", label: "추론 낮음" },
  { value: "medium", label: "추론 보통" },
  { value: "high", label: "추론 높음" },
] as const;

const FEATURES = [
  {
    icon: "/upstage/document-parse.svg",
    title: "Document Parse",
    description: "PDF·스캔·오피스·HWP 문서를 마크다운으로 구조화",
  },
  {
    icon: "/upstage/information-extract.svg",
    title: "Information Extract",
    description: "모델이 스키마를 설계해 핵심 필드를 JSON으로 추출",
  },
  {
    icon: "/upstage/symbol.png",
    title: "Studio Agents",
    description: "Parse→Classify→Extract→Instruct 파이프라인 실행",
  },
];

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
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton
      aria-label="문서 첨부"
      onClick={attachments.openFileDialog}
      type="button"
    >
      <PaperclipIcon className="size-4" />
      <span className="max-sm:hidden">문서 첨부</span>
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

function PromptSuggestions({
  onSend,
}: {
  onSend: (text: string, files: FileUIPart[]) => void;
}) {
  const attachments = usePromptInputAttachments();

  return (
    <Suggestions className="mb-3">
      {SUGGESTIONS.map((suggestion) => (
        <Suggestion
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
  const { messages, sendMessage, status, stop, regenerate, setMessages, error, clearError } =
    useChat({
      transport: new DefaultChatTransport({ api: "/api/chat" }),
    });
  const [fileError, setFileError] = useState<string | null>(null);
  const [reasoningEffort, setReasoningEffort] = useState<string>("high");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const requestBody = { reasoningEffort };
  const isBusy = status === "submitted" || status === "streaming";

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text && message.files.length === 0) {
      return;
    }
    setFileError(null);
    sendMessage(
      { text: text || "첨부한 문서를 분석해줘.", files: message.files },
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
    <PromptInputProvider>
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col bg-background">
      {messages.length > 0 && (
        <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-1 px-4 pt-2">
          <ConversationDownload
            aria-label="대화 내보내기"
            className="static top-auto right-auto size-7 rounded-lg border-transparent bg-transparent shadow-none hover:bg-muted dark:bg-transparent dark:hover:bg-muted/50"
            filename="moabora-chat.md"
            messages={messages}
            size="icon-sm"
            variant="ghost"
          >
            <DownloadIcon className="size-4" />
          </ConversationDownload>
          <Button
            aria-label="새 대화"
            onClick={handleNewChat}
            size="icon-sm"
            variant="ghost"
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      )}

      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <div className="flex min-h-[55dvh] flex-col items-center justify-center gap-8 px-4 text-center">
              <div className="flex flex-col items-center gap-3">
                <h2 className="font-semibold text-xl">
                  문서를 첨부하고 무엇이든 물어보세요
                </h2>
                <p className="max-w-md text-balance text-muted-foreground text-sm">
                  모델이 Upstage 문서 API를 도구로 호출해서 문서를 읽고,
                  추출하고, 처리합니다. 추론 과정도 실시간으로 확인할 수
                  있습니다.
                </p>
              </div>
              <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
                {FEATURES.map((feature) => (
                  <div
                    className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-card-foreground"
                    key={feature.title}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={`Upstage ${feature.title}`}
                      className="size-8 rounded-lg"
                      height={32}
                      src={feature.icon}
                      width={32}
                    />
                    <span className="font-medium text-sm">{feature.title}</span>
                    <span className="text-balance text-muted-foreground text-xs">
                      {feature.description}
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
                                  <Shimmer duration={1}>추론 중...</Shimmer>
                                ) : (
                                  <p>
                                    {duration
                                      ? `${duration}초 동안 추론함`
                                      : "추론 완료"}
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
                              title={TOOL_TITLES[part.type]}
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
                        tooltip="답변 복사"
                      >
                        {copiedId === message.id ? (
                          <CheckIcon className="size-3.5 text-green-600" />
                        ) : (
                          <CopyIcon className="size-3.5" />
                        )}
                      </MessageAction>
                      {isLastMessage && (
                        <MessageAction
                          onClick={() => regenerate({ body: requestBody })}
                          tooltip="다시 생성"
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
                <Shimmer>생각하는 중...</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        {error && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm">
            <span className="min-w-0 truncate text-destructive">
              오류가 발생했습니다: {error.message}
            </span>
            <Button
              onClick={() => regenerate({ body: requestBody })}
              size="sm"
              variant="outline"
            >
              재시도
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
          onError={(error) =>
            setFileError(
              error.code === "accept"
                ? "지원하지 않는 파일 형식입니다."
                : error.code === "max_file_size"
                  ? "파일 크기는 50MB 이하여야 합니다."
                  : "파일은 최대 5개까지 첨부할 수 있습니다.",
            )
          }
          onSubmit={handleSubmit}
        >
          <InputAttachments />
          <PromptInputBody>
            <PromptInputTextarea placeholder="문서를 첨부하고 질문을 입력하세요... (드래그 앤 드롭 지원)" />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <AttachButton />
              <PromptInputSelect
                onValueChange={setReasoningEffort}
                value={reasoningEffort}
              >
                <PromptInputSelectTrigger
                  aria-label="추론 수준"
                  className="h-8 gap-1.5 text-xs"
                >
                  <BrainIcon className="size-4" />
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {REASONING_OPTIONS.map((option) => (
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
        <p className="mt-2 text-center text-muted-foreground text-xs">
          {fileError ??
            "지원 형식: PDF · 이미지(JPG/PNG/TIFF/HEIC) · DOCX · PPTX · XLSX · HWP (최대 50MB)"}
        </p>
      </div>
    </div>
    </PromptInputProvider>
  );
}
