// @vitest-environment node
// Node's fetch, Request and AbortSignal must come from one realm; jsdom would mix them.
import { readFileSync } from "node:fs";
import path from "node:path";
import { POST } from "@/app/api/predictions/rent/route";
import { interpretPredictionResponse } from "@/lib/api/prediction/interpret";
import { proxyRentPrediction, readProxyEnv, type ProxyEnv } from "@/lib/api/prediction/proxy";

const fixture = (name: string) =>
  readFileSync(path.join(process.cwd(), "tests/contracts/fixtures", name), "utf8");
const requestBody = fixture("rent.v1.request.json");

const configured: ProxyEnv = { baseUrl: "https://model.example/", apiKey: "secret-key", timeoutMs: 5_000 };

function post(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/predictions/rent", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

const json = (body: string, status: number, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { "Content-Type": "application/json", ...headers } });

describe("readProxyEnv", () => {
  it("is not configured without a base URL", () => {
    expect(readProxyEnv({})).toEqual({ baseUrl: null, apiKey: null, timeoutMs: 10_000, embedded: false });
  });

  it("reads the base URL, key and timeout", () => {
    expect(
      readProxyEnv({
        PREDICTION_API_BASE_URL: "https://model.example",
        PREDICTION_API_KEY: "k",
        PREDICTION_TIMEOUT_MS: "4000",
      }),
    ).toEqual({ baseUrl: "https://model.example", apiKey: "k", timeoutMs: 4_000, embedded: false });
  });

  it("treats a malformed value as not configured rather than guessing", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(readProxyEnv({ PREDICTION_API_BASE_URL: "ftp://model.example" }).baseUrl).toBeNull();
    expect(readProxyEnv({ PREDICTION_API_BASE_URL: "https://m.example", PREDICTION_TIMEOUT_MS: "5" }).baseUrl).toBeNull();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("POST /api/predictions/rent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("answers 503 PREDICTION_ENGINE_NOT_CONFIGURED by default and calls nothing", async () => {
    vi.stubEnv("PREDICTION_API_BASE_URL", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(post(requestBody, { "X-Request-ID": "req-123" }));
    expect(res.status).toBe(503);
    expect(res.headers.get("x-request-id")).toBe("req-123");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const text = await res.text();
    expect(JSON.parse(text).error).toMatchObject({ code: "PREDICTION_ENGINE_NOT_CONFIGURED", retryable: false });
    expect(fetchSpy).not.toHaveBeenCalled();
    // The browser side turns it into the designed "not connected" state.
    expect(interpretPredictionResponse(res.status, text, "req-123")).toEqual({
      status: "not_connected",
      reason: "not_configured",
      requestId: "req-123",
    });
  });

  it("rejects a body that is not JSON (400) or not contract v1 (422) before calling the model", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const notJson = await proxyRentPrediction(post("{nope"), configured, fetchImpl);
    expect(notJson.status).toBe(400);
    expect((await notJson.json()).error.code).toBe("VALIDATION_ERROR");

    const invalid = await proxyRentPrediction(
      post(JSON.stringify({ ...JSON.parse(requestBody), area_m2: 5, extra: true })),
      configured,
      fetchImpl,
    );
    expect(invalid.status).toBe(422);
    const body = await invalid.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(["area_m2"]),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses bodies over 16 kB", async () => {
    const res = await proxyRentPrediction(post(" ".repeat(20_000)), configured, vi.fn<typeof fetch>());
    expect(res.status).toBe(413);
  });

  it("forwards a valid request with the key only in the upstream Authorization header", async () => {
    const ok = fixture("rent.v1.ok.json");
    const fetchImpl = vi.fn<typeof fetch>(async () => json(ok, 200));
    const res = await proxyRentPrediction(post(requestBody, { "X-Request-ID": "req-1" }), configured, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://model.example/api/v1/predictions/rent");
    const sent = new Headers(init?.headers);
    expect(sent.get("authorization")).toBe("Bearer secret-key");
    expect(sent.get("x-request-id")).toBe("req-1");
    expect(JSON.parse(String(init?.body))).toEqual(JSON.parse(requestBody));

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(ok);
    expect(text).not.toContain("secret-key");
    expect([...res.headers.values()].join(" ")).not.toContain("secret-key");
  });

  it("sends no Authorization header when no key is set", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(fixture("rent.v1.ok.json"), 200));
    await proxyRentPrediction(post(requestBody), { ...configured, apiKey: null }, fetchImpl);
    expect(new Headers(fetchImpl.mock.calls[0]![1]?.headers).has("authorization")).toBe(false);
  });

  it("passes error envelopes and Retry-After through unchanged", async () => {
    const envelope = fixture("rent.v1.error-unavailable.json");
    const fetchImpl = vi.fn<typeof fetch>(async () => json(envelope, 503, { "Retry-After": "7" }));
    const res = await proxyRentPrediction(post(requestBody), configured, fetchImpl);
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("7");
    expect(await res.text()).toBe(envelope);
  });

  it("drops a non-JSON upstream body so only the status reaches the browser", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("<html>Bad gateway</html>", { status: 502, headers: { "Content-Type": "text/html" } }),
    );
    const res = await proxyRentPrediction(post(requestBody, { "X-Request-ID": "r" }), configured, fetchImpl);
    expect(res.status).toBe(502);
    expect(res.headers.get("content-type")).toBe("application/json");
    const text = await res.text();
    expect(text).toBe("");
    expect(interpretPredictionResponse(502, text, "r")).toMatchObject({ status: "unavailable", retryable: true });
  });

  it("maps an upstream timeout to 504 and a network failure to 502, both retryable", async () => {
    const hang = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const timedOut = await proxyRentPrediction(post(requestBody), { ...configured, timeoutMs: 20 }, hang);
    expect(timedOut.status).toBe(504);
    expect((await timedOut.json()).error).toMatchObject({ code: "UPSTREAM_TIMEOUT", retryable: true });

    const down = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    const unreachable = await proxyRentPrediction(post(requestBody), configured, down);
    expect(unreachable.status).toBe(502);
    expect((await unreachable.json()).error).toMatchObject({ code: "UPSTREAM_UNREACHABLE", retryable: true });
  });

  it("replaces a request id that isn't a safe token", async () => {
    const res = await proxyRentPrediction(
      post(requestBody, { "X-Request-ID": "<script>" }),
      { ...configured, baseUrl: null },
    );
    const id = res.headers.get("x-request-id") ?? "";
    expect(id).not.toBe("<script>");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("embedded demo model (D-061)", () => {
  const embedded: ProxyEnv = { baseUrl: null, apiKey: null, timeoutMs: 5_000, embedded: true };
  const refuseToFetch = () =>
    vi.fn<typeof fetch>(async () => {
      throw new Error("must not call out");
    });

  it("is switched on only by NEXT_PUBLIC_PREDICTION_MODE=embedded", () => {
    expect(readProxyEnv({ NEXT_PUBLIC_PREDICTION_MODE: "embedded" }).embedded).toBe(true);
    expect(readProxyEnv({ NEXT_PUBLIC_PREDICTION_MODE: "proxy" }).embedded).toBe(false);
    expect(readProxyEnv({}).embedded).toBe(false);
  });

  it("answers in-process, without any network call, and the client accepts it as a synthetic demo", async () => {
    const fetchImpl = refuseToFetch();
    const res = await proxyRentPrediction(post(requestBody, { "X-Request-ID": "req-9" }), embedded, fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("req-9");
    const text = await res.text();
    const outcome = interpretPredictionResponse(res.status, text, "req-9");
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok") {
      expect(outcome.trainedOn).toBe("synthetic");
      expect(outcome.data.estimate.monthly_cold_rent.value).toBeGreaterThan(0);
    }
  });

  it("still validates against contract v1 first", async () => {
    const bad = JSON.stringify({ ...JSON.parse(requestBody), area_m2: 5 });
    const res = await proxyRentPrediction(post(bad), embedded, refuseToFetch());
    expect(res.status).toBe(422);
  });

  it("keeps a configured upstream in charge", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(fixture("rent.v1.ok.json"), 200));
    await proxyRentPrediction(post(requestBody), { ...configured, embedded: true }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("reports MODEL_UNAVAILABLE instead of crashing when the model throws", async () => {
    vi.resetModules();
    vi.doMock("@/lib/model/rent-model", () => ({
      predictRent: () => {
        throw new Error("boom");
      },
    }));
    const { proxyRentPrediction: proxy } = await import("@/lib/api/prediction/proxy");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await proxy(post(requestBody), embedded, refuseToFetch());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatchObject({ code: "MODEL_UNAVAILABLE", retryable: true });
    vi.doUnmock("@/lib/model/rent-model");
    vi.restoreAllMocks();
  });
});
