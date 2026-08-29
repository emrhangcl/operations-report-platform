import "server-only";

import { randomUUID } from "node:crypto";

const requestIdPattern = /^[A-Za-z0-9._:-]{1,100}$/;
const sensitiveKeyPattern = /pass(word)?|token|secret|authorization|cookie|api[_-]?key|service[_-]?role|signature|card|cvv|iban/i;
const personalKeyPattern = /email|phone|mobile|name|address|tax|identifier|ip/i;

export type LogLevel = "info" | "warn" | "error";

export function getRequestId(request: Request) {
  const incomingRequestId = request.headers.get("x-request-id")?.trim();
  return incomingRequestId && requestIdPattern.test(incomingRequestId) ? incomingRequestId : randomUUID();
}

function maskText(value: string) {
  return value
    .replace(/(bearer\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/((?:password|secret|token|api[_-]?key|service[_-]?role)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .slice(0, 2000);
}

function sanitize(value: unknown, key = "", depth = 0): unknown {
  if (sensitiveKeyPattern.test(key) || personalKeyPattern.test(key)) return "[REDACTED]";
  if (depth > 3) return "[TRUNCATED]";
  if (typeof value === "string") return maskText(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: maskText(value.message),
      stack: value.stack ? maskText(value.stack) : undefined
    };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, key, depth + 1));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 40)
        .map(([entryKey, entryValue]) => [entryKey, sanitize(entryValue, entryKey, depth + 1)])
    );
  }
  return String(value);
}

export function logServerEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const payload = sanitize({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields
  }) as Record<string, unknown>;
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else if (process.env.NODE_ENV !== "production") {
    console.info(line);
  }
}

export function logRequestError(
  request: Request,
  event: string,
  error: unknown,
  fields: Record<string, unknown> = {}
) {
  logServerEvent("error", event, {
    request_id: getRequestId(request),
    error,
    ...fields
  });
}
