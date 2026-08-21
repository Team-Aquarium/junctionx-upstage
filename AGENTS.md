# AGENTS.md

Junction Asia 2026 Upstage 트랙 프로젝트. Solar Pro 4가 Upstage 문서 API들을 툴로 호출하는
문서 에이전트 챗 서비스다. 이 문서는 이 저장소에서 작업하는 AI 에이전트/개발자가 지켜야 할
아키텍처와 컨벤션을 정의한다.

## 스택

| 영역 | 사용 기술 | 비고 |
| --- | --- | --- |
| 프레임워크 | Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 | |
| AI | Vercel AI SDK v7 (`ai`, `@ai-sdk/react`) | 아래 "AI 레이어" 참고 |
| LLM | Upstage `solar-pro4` (OpenAI 호환 API 직접 연결) | AI Gateway 아님 — 주의 |
| UI | shadcn/ui (radix 베이스) + AI Elements | 소스가 저장소에 포함됨 |
| 스키마 검증 | zod v4 | 툴 inputSchema |
| 테마 | next-themes | class 기반 dark 모드 |

## 명령어

```bash
npm run dev     # 개발 서버 (localhost:3000)
npm run build   # 프로덕션 빌드 + 타입체크 (작업 후 반드시 통과 확인)
npm run lint    # eslint
```

## 디렉터리 구조

```
app/
  api/chat/route.ts   # 파이프라인 핵심: streamText + 툴 정의 + reasoning 옵션
  page.tsx            # 챗 UI 전체 (단일 페이지)
  layout.tsx          # ThemeProvider, TooltipProvider
lib/
  upstage.ts          # Upstage REST 클라이언트 (Parse / Extract / Files / Jobs)
components/
  ai-elements/        # AI Elements 컴포넌트 (로컬 패치 있음 — 아래 주의사항)
  ui/                 # shadcn/ui 컴포넌트
```

## AI 레이어 (Vercel AI SDK)

**중요**: 팀 내에서 "Vercel AI Gateway"라고 부르지만, 실제로는 Gateway를 쓰지 않는다.
Gateway는 Vercel 발급 키(`vck_`)가 필요해서, 동일한 AI SDK 인터페이스로
`@ai-sdk/openai-compatible`을 통해 `https://api.upstage.ai/v1`에 **직접** 연결한다.
provider 이름은 `upstage`이며, 이 이름이 `providerOptions`의 키가 된다.

```ts
const upstage = createOpenAICompatible({
  name: "upstage",
  baseURL: "https://api.upstage.ai/v1",
  apiKey: process.env.UPSTAGE_API_KEY ?? "",
});

streamText({
  model: upstage(process.env.UPSTAGE_CHAT_MODEL ?? "solar-pro4"),
  stopWhen: stepCountIs(8),                                  // 툴 루프 상한
  providerOptions: { upstage: { reasoningEffort: "high" } }, // reasoning 켜기
  ...
});
```

### 문서 처리 흐름 (docId 패턴)

Solar 챗 API는 파일 입력을 받지 못한다. 그래서:

1. 클라이언트가 파일을 data URL로 담은 `file` 파트로 전송
2. `route.ts`의 `collectDocuments()`가 file 파트를 서버 레지스트리로 옮기고,
   모델에게는 `[첨부 문서] docId="doc-1" ...` 텍스트 마커만 전달
3. 모델이 툴 호출 시 `docId`로 문서를 참조

### 툴 3종 (`app/api/chat/route.ts`)

| 툴 | Upstage API | 엔드포인트 |
| --- | --- | --- |
| `parse_document` | Document Parse | `POST /v1/document-digitization` (multipart) |
| `extract_information` | Universal Information Extraction | `POST /v1/information-extraction/chat/completions` |
| `run_studio_agent` | Studio Agents API | `POST /v2/files` → `POST /v2/responses` → 폴링 |

- 툴 실행 실패는 throw하지 않고 `{ error: string }`을 반환한다 — 모델이 읽고 자가 수정한다.
- 파싱 결과는 sha256 키 메모리 캐시로 재과금을 방지한다 (`lib/upstage.ts`).
- 파싱 마크다운은 40,000자에서 잘라 컨텍스트 폭주를 막는다.
- 새 툴 추가 시: `lib/upstage.ts`에 API 클라이언트 → `route.ts`에 `tool()` 정의 →
  `page.tsx`의 `TOOL_TITLES`에 한국어 제목 추가.

### Reasoning

- 요청 body의 `reasoningEffort`(`low`/`medium`/`high`, 그 외 값은 끔)를
  `providerOptions.upstage.reasoningEffort`로 전달한다.
- Upstage는 스트리밍 델타에 `reasoning` 필드를 실어 보내고, openai-compatible provider가
  이를 reasoning 파트로 자동 매핑한다. `toUIMessageStreamResponse({ sendReasoning: true })` 필수.

## UI 레이어 (shadcn/ui + AI Elements)

- 컴포넌트 추가: `npx shadcn@latest add <name>` 또는 `npx ai-elements@latest add <name>`.
  단, **덮어쓰기 주의** — 아래 로컬 패치가 날아갈 수 있다.
- 로컬 패치된 파일 (재설치 시 `--overwrite` 금지, diff 확인 필수):
  - `prompt-input.tsx` — `matchesAccept`에 `.pdf` 같은 확장자 패턴 지원 추가
  - `message.tsx`, `reasoning.tsx` — streamdown/shiki 중첩 버전 타입 캐스팅
  - `context.tsx`, `agent.tsx`, `schema-display.tsx` — AI SDK v7 타입 호환 수정
- 스타일은 Tailwind 유틸리티 + `cn()`(`lib/utils.ts`)만 사용. CSS 파일 추가 금지.
- 테마 토큰(`bg-background`, `text-muted-foreground` 등)을 쓰고 색상 하드코딩 금지.
- UI 문구는 한국어가 기본이다.

## 상태 관리

**전역 스토어(Redux/Zustand 등)를 도입하지 않는다.** 현재 구조로 충분하다.

| 상태 | 관리 방식 | 위치 |
| --- | --- | --- |
| 대화(메시지/스트리밍/에러) | `useChat` (`@ai-sdk/react`) | `page.tsx` |
| 입력 텍스트 + 첨부 파일 | `PromptInputProvider` Context | `page.tsx` 최상단 래핑 |
| 추론 수준, 복사 피드백, 파일 에러 | 로컬 `useState` | `page.tsx` |
| 테마 | `next-themes` | `layout.tsx` |
| 파싱 캐시 | 서버 메모리 `Map` (모듈 스코프) | `lib/upstage.ts` |

주의: `PromptInputProvider`를 제거하면 안 된다. 없으면 전송 시 `form.reset()`이
폼 내부 Select(추론 수준)까지 초기화하고, 예시 프롬프트가 첨부 파일을 읽지 못한다.

## 환경변수 (`.env.local`, 커밋 금지)

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `UPSTAGE_API_KEY` | O | `up_...` 키. 코드에 하드코딩 절대 금지 |
| `UPSTAGE_CHAT_MODEL` | X | 기본 `solar-pro4` |
| `UPSTAGE_AGENT_ID` | X | Studio 에이전트 기본 ID (`agt_...`) |

`.env.example`이 템플릿이며 이것만 커밋한다 (`.gitignore`에 `!.env.example` 예외 있음).

## 주의사항

- 트랙 요구사항: "Upstage Studio must power the core document-processing stages" —
  최종 제출은 `run_studio_agent` 경로가 핵심 처리를 담당해야 한다.
- Upstage API 호출은 과금된다. 테스트는 1페이지짜리 작은 문서로 하고,
  같은 파일 반복 파싱은 캐시에 맡긴다.
- 커밋 전 `npm run build`로 타입체크를 통과시킨다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
