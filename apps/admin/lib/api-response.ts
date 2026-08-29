import "server-only";

import { NextResponse } from "next/server";
import { getRequestId, logRequestError } from "./observability";

export function withRequestId(request: Request, response: Response) {
  response.headers.set("X-Request-ID", getRequestId(request));
  return response;
}

export function apiError(
  request: Request,
  status: number,
  message: string,
  event = "api_error",
  error?: unknown
) {
  const requestId = getRequestId(request);
  if (error) logRequestError(request, event, error);

  return NextResponse.json(
    {
      message,
      request_id: requestId
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-ID": requestId
      }
    }
  );
}
