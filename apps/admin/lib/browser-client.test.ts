import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Istemci durumu modul seviyesinde tutulur; her test temiz bir modulle baslar.
type BrowserClientModule = typeof import("./browser-client");
let mod: BrowserClientModule;

const session = {
  user: { id: "u1", email: "admin@test.invalid", email_confirmed_at: null },
  expires_at: "2026-10-24T18:00:00.000Z"
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const okRows = (rows: unknown[]) => json({ data: rows, error: null, count: null, status: 200 });

function stubFetch(...responses: (Response | Error)[]) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) fetchMock.mockRejectedValueOnce(response);
    else fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function callOf(fetchMock: ReturnType<typeof stubFetch>, index = 0) {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`fetch call ${index} not found`);
  return { url: call[0] as string, init: call[1] as RequestInit };
}

beforeEach(async () => {
  vi.resetModules();
  mod = await import("./browser-client");
});

afterEach(() => vi.unstubAllGlobals());

describe("scopeHeaders", () => {
  it("returns the auth scope header for both scopes", () => {
    expect(mod.scopeHeaders("admin")).toEqual({ "X-Auth-Scope": "admin" });
    expect(mod.scopeHeaders("personnel")).toEqual({ "X-Auth-Scope": "personnel" });
  });

  it("sends the scope header with data requests", async () => {
    const fetchMock = stubFetch(okRows([]));
    await mod.getBrowserClient("personnel").from("reports").select("id");
    const { url, init } = callOf(fetchMock);
    expect(url).toBe("/api/data");
    expect(init.headers).toMatchObject({ "X-Auth-Scope": "personnel", "Content-Type": "application/json" });
  });
});

describe("read cache", () => {
  it("serves a repeated read from the cache without a second request", async () => {
    const fetchMock = stubFetch(okRows([{ id: 1 }]));
    const client = mod.getBrowserClient("admin");
    const first = await client.from("companies").select("id");
    const second = await client.from("companies").select("id");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.data).toEqual([{ id: 1 }]);
    expect(second.data).not.toBe(first.data);
  });

  it("shares one request between concurrent identical reads", async () => {
    const fetchMock = stubFetch(okRows([{ id: 1 }]));
    const client = mod.getBrowserClient("admin");
    const [a, b] = await Promise.all([client.from("companies").select("id"), client.from("companies").select("id")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.data).toEqual(b.data);
  });

  it("goes to the network again after clearReadCache", async () => {
    const fetchMock = stubFetch(okRows([{ id: 1 }]), okRows([{ id: 2 }]));
    const client = mod.getBrowserClient("admin");
    await client.from("companies").select("id");
    mod.clearReadCache();
    const result = await client.from("companies").select("id");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual([{ id: 2 }]);
  });

  it("keeps cache entries separate per scope", async () => {
    const fetchMock = stubFetch(okRows([{ id: 1 }]), okRows([{ id: 2 }]));
    await mod.getBrowserClient("admin").from("companies").select("id");
    await mod.getBrowserClient("personnel").from("companies").select("id");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache failed reads", async () => {
    const fetchMock = stubFetch(
      json({ data: null, error: { message: "Gecici hata", code: "internal" }, count: null, status: 500 }),
      okRows([{ id: 1 }])
    );
    const client = mod.getBrowserClient("admin");
    expect((await client.from("companies").select("id")).error?.message).toBe("Gecici hata");
    expect((await client.from("companies").select("id")).data).toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("invalidates cached reads after a successful write", async () => {
    const fetchMock = stubFetch(okRows([{ id: 1 }]), okRows([]), okRows([{ id: 1 }, { id: 2 }]));
    const client = mod.getBrowserClient("admin");
    await client.from("companies").select("id");
    await client.from("companies").insert({ name: "Yeni" });
    const result = await client.from("companies").select("id");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

describe("query errors", () => {
  it("returns an invalid_response error when the response is not JSON", async () => {
    stubFetch(new Response("<html>Bad Gateway</html>", { status: 502 }));
    const result = await mod.getBrowserClient("admin").from("companies").select("id");
    expect(result).toEqual({
      data: null,
      error: { message: "Sunucu yaniti okunamadi.", code: "invalid_response" },
      count: null,
      status: 502
    });
  });

  it("returns a transport_error instead of throwing when fetch rejects", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    const result = await mod.getBrowserClient("admin").from("companies").select("id");
    expect(result.data).toBeNull();
    expect(result.error).toEqual({ message: "Failed to fetch", code: "transport_error" });
  });

  it("marks the session signed out when the server reports session_expired", async () => {
    stubFetch(
      json(session),
      json({ data: null, error: { message: "Oturum suresi doldu.", code: "session_expired" }, count: null, status: 401 })
    );
    const client = mod.getBrowserClient("admin");
    expect((await client.auth.getSession()).data.session).toEqual(session);
    const listener = vi.fn();
    client.auth.onAuthStateChange(listener);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith("INITIAL_SESSION", session));
    await client.from("companies").select("id");
    expect(listener).toHaveBeenCalledWith("SIGNED_OUT", null);
    expect((await client.auth.getSession()).data.session).toBeNull();
  });
});

describe("session", () => {
  it("returns the session from a successful response and caches it", async () => {
    const fetchMock = stubFetch(json(session));
    const client = mod.getBrowserClient("admin");
    expect((await client.auth.getSession()).data.session).toEqual(session);
    expect((await client.auth.getSession()).data.session).toEqual(session);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = callOf(fetchMock);
    expect(url).toBe("/api/auth/session");
    expect(init.headers).toEqual({ "X-Auth-Scope": "admin" });
  });

  it("returns no session for a 401 response", async () => {
    stubFetch(json({ message: "Oturum yok" }, 401));
    expect((await mod.getBrowserClient("admin").auth.getSession()).data.session).toBeNull();
  });

  it("returns no session when the body is not valid JSON", async () => {
    stubFetch(new Response("not json", { status: 200 }));
    expect((await mod.getBrowserClient("admin").auth.getSession()).data.session).toBeNull();
  });

  it("returns no session when the body lacks user or expiry", async () => {
    stubFetch(json({ user: session.user }));
    expect((await mod.getBrowserClient("admin").auth.getSession()).data.session).toBeNull();
  });

  it("returns an error from getUser when there is no session", async () => {
    stubFetch(json({}, 401));
    const result = await mod.getBrowserClient("admin").auth.getUser();
    expect(result).toEqual({ data: { user: null }, error: { message: "Oturum bulunamadi." } });
  });

  it("does not throw when the session request fails on the network", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect((await mod.getBrowserClient("admin").auth.getSession()).data.session).toBeNull();
  });
});

describe("storage upload", () => {
  const file = new Blob(["x"], { type: "image/jpeg" });

  it("uses the server message when the upload fails", async () => {
    stubFetch(json({ message: "Dosya turu desteklenmiyor." }, 415));
    const result = await mod.getBrowserClient("personnel").storage.from("report-photos").upload("a/b.jpg", file);
    expect(result).toEqual({ data: null, error: { message: "Dosya turu desteklenmiyor.", status: 415 } });
  });

  it("falls back to the default message when the error has no message", async () => {
    stubFetch(new Response("Internal Server Error", { status: 500 }));
    const result = await mod.getBrowserClient("personnel").storage.from("report-photos").upload("a/b.jpg", file);
    expect(result).toEqual({ data: null, error: { message: "Dosya yuklenemedi.", status: 500 } });
  });

  it("treats a success response without a path as a failure", async () => {
    stubFetch(json({}));
    const result = await mod.getBrowserClient("personnel").storage.from("report-photos").upload("a/b.jpg", file);
    expect(result.error).toEqual({ message: "Dosya yuklenemedi.", status: 200 });
  });

  it("returns a network error message when fetch rejects", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    const result = await mod.getBrowserClient("personnel").storage.from("report-photos").upload("a/b.jpg", file);
    expect(result).toEqual({ data: null, error: { message: "Sunucuya ulasilamadi." } });
  });

  it("encodes the object path and sends scope, content type and upsert", async () => {
    const fetchMock = stubFetch(json({ path: "org 1/rapor.jpg" }));
    const result = await mod.getBrowserClient("personnel").storage.from("report-photos")
      .upload("org 1/rapor.jpg", file, { upsert: true });
    expect(result).toEqual({ data: { path: "org 1/rapor.jpg" }, error: null });
    const { url, init } = callOf(fetchMock);
    expect(url).toBe("/api/storage/object/report-photos/org%201/rapor.jpg?upsert=true");
    expect(init.headers).toEqual({ "Content-Type": "image/jpeg", "X-Auth-Scope": "personnel" });
  });
});
