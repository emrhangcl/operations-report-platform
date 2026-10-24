import { describe, expect, it, vi } from "vitest";

import { readJsonBody, readTextBody } from "./request-body";

const url = "http://localhost:3000/api/admin/test";
const encoder = new TextEncoder();

function streamRequest(chunks: Uint8Array[], onCancel = vi.fn()) {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(chunks[index++]);
      else controller.close();
    },
    cancel: onCancel
  });
  return new Request(url, { method: "POST", body, duplex: "half" } as RequestInit);
}

describe("readTextBody", () => {
  it("rejects with 413 when content-length exceeds the limit", async () => {
    const request = new Request(url, {
      method: "POST",
      // Gövde küçük; 413 yalnızca başlık kontrolünden gelebilir.
      headers: { "content-length": "1000" },
      body: "a"
    });

    await expect(readTextBody(request, 10)).resolves.toEqual({
      ok: false,
      status: 413,
      message: "İstek gövdesi çok büyük."
    });
  });

  it("rejects with 400 when there is no body", async () => {
    const request = new Request(url, { method: "POST" });

    await expect(readTextBody(request, 10)).resolves.toEqual({
      ok: false,
      status: 400,
      message: "İstek gövdesi okunamadı."
    });
  });

  it("rejects with 413 and cancels the stream when it grows past the limit without content-length", async () => {
    const onCancel = vi.fn();
    const request = streamRequest([encoder.encode("12345"), encoder.encode("67890"), encoder.encode("x")], onCancel);
    expect(request.headers.get("content-length")).toBeNull();

    await expect(readTextBody(request, 10)).resolves.toEqual({
      ok: false,
      status: 413,
      message: "İstek gövdesi çok büyük."
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("accepts a stream that is exactly at the limit", async () => {
    const request = streamRequest([encoder.encode("12345"), encoder.encode("67890")]);

    await expect(readTextBody(request, 10)).resolves.toEqual({ ok: true, value: "1234567890" });
  });

  it("decodes multi-byte UTF-8 characters split across chunks", async () => {
    const bytes = encoder.encode("çğış€😀");
    // Her karakteri ortasından bölen tek baytlık parçalar.
    const chunks = Array.from(bytes, (byte) => Uint8Array.of(byte));
    const request = streamRequest(chunks);

    await expect(readTextBody(request, 100)).resolves.toEqual({ ok: true, value: "çğış€😀" });
  });

  it("returns 400 when reading the stream fails", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("connection reset"));
      }
    });
    const request = new Request(url, { method: "POST", body, duplex: "half" } as RequestInit);

    await expect(readTextBody(request, 10)).resolves.toEqual({
      ok: false,
      status: 400,
      message: "İstek gövdesi okunamadı."
    });
  });

  it("returns the body for a normal request", async () => {
    const request = new Request(url, { method: "POST", body: "merhaba dünya" });

    await expect(readTextBody(request, 100)).resolves.toEqual({ ok: true, value: "merhaba dünya" });
  });
});

describe("readJsonBody", () => {
  it("parses valid JSON", async () => {
    const request = new Request(url, { method: "POST", body: JSON.stringify({ name: "Şube", count: 2 }) });

    await expect(readJsonBody(request, 100)).resolves.toEqual({ ok: true, value: { name: "Şube", count: 2 } });
  });

  it("rejects malformed JSON with 400 and a Turkish message", async () => {
    const request = new Request(url, { method: "POST", body: "{\"name\":" });

    await expect(readJsonBody(request, 100)).resolves.toEqual({
      ok: false,
      status: 400,
      message: "Geçerli bir JSON isteği gönderin."
    });
  });

  it("passes the 413 result through unchanged", async () => {
    const request = new Request(url, {
      method: "POST",
      headers: { "content-length": "200" },
      body: JSON.stringify({ text: "a".repeat(190) })
    });

    await expect(readJsonBody(request, 100)).resolves.toEqual({
      ok: false,
      status: 413,
      message: "İstek gövdesi çok büyük."
    });
  });
});
