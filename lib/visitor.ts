export const VISITOR_COOKIE = "moabora-vid";
export const VISITOR_HEADER = "x-moabora-vid";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isVisitorId(value: string): boolean {
  return UUID_RE.test(value);
}

export function newVisitorId(): string {
  return crypto.randomUUID();
}

export function visitorIdFromCookieHeader(
  cookieHeader: string | null | undefined,
): string | null {
  const match = cookieHeader?.match(new RegExp(`(?:^|;\\s*)${VISITOR_COOKIE}=([^;]+)`));
  if (!match?.[1]) {
    return null;
  }
  const value = decodeURIComponent(match[1]);
  return isVisitorId(value) ? value : null;
}

/** Middleware stamps the header; cookie is the durable fallback. */
export function visitorIdFromRequest(req: Request): string {
  const header = req.headers.get(VISITOR_HEADER);
  if (header && isVisitorId(header)) {
    return header;
  }
  return visitorIdFromCookieHeader(req.headers.get("cookie")) ?? newVisitorId();
}

export function scopedWorkflowKey(req: Request, key: string): string {
  return `${visitorIdFromRequest(req)}:${key}`;
}
