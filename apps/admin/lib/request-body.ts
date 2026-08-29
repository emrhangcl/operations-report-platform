import "server-only";

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413; message: string };

export type TextBodyResult =
  | { ok: true; value: string }
  | { ok: false; status: 400 | 413; message: string };

export async function readTextBody(request: Request, maxBytes: number): Promise<TextBodyResult> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, status: 413, message: "İstek gövdesi çok büyük." };
  }

  if (!request.body) {
    return { ok: false, status: 400, message: "İstek gövdesi okunamadı." };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413, message: "İstek gövdesi çok büyük." };
      }

      chunks.push(decoder.decode(value, { stream: true }));
    }
  } catch {
    return { ok: false, status: 400, message: "İstek gövdesi okunamadı." };
  } finally {
    reader.releaseLock();
  }

  chunks.push(decoder.decode());
  return { ok: true, value: chunks.join("") };
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  const body = await readTextBody(request, maxBytes);
  if (!body.ok) return body;

  try {
    return { ok: true, value: JSON.parse(body.value) };
  } catch {
    return { ok: false, status: 400, message: "Geçerli bir JSON isteği gönderin." };
  }
}
