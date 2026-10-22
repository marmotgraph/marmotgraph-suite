import { getJson, send } from "./http";

function respondWith(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

describe("getJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares the result of an identical request in flight", async () => {
    const fetchMock = respondWith(["a"]);
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      getJson("/api/types", "the types", "token"),
      getJson("/api/types", "the types", "token"),
    ]);

    expect(first).toEqual(["a"]);
    expect(second).toEqual(["a"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the request again once the previous one completed", async () => {
    const fetchMock = respondWith([]);
    vi.stubGlobal("fetch", fetchMock);

    await getJson("/api/types", "the types", "token");
    await getJson("/api/types", "the types", "token");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("doesn't share requests of different urls or tokens", async () => {
    const fetchMock = respondWith([]);
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      getJson("/api/types", "the types", "token"),
      getJson("/api/types", "the types", "otherToken"),
      getJson("/api/spaces", "the spaces", "token"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports a failed request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }),
    );

    await expect(getJson("/api/instances/x", "the instance", "token")).rejects.toThrow(
      "Failed to load the instance (404 Not Found)",
    );
  });
});

describe("send", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serializes JSON bodies and returns the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"a":1}'),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await send("PATCH", "/api/x", "update x", "token", { b: 2 });

    expect(result).toEqual({ a: 1 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe('{"b":2}');
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers.Authorization).toBe("Bearer token");
  });

  it("sends strings as plain text and tolerates empty responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("") });
    vi.stubGlobal("fetch", fetchMock);

    expect(await send("PUT", "/api/css", "update the css", "token", ".a{}")).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBe("text/plain");
  });

  it("reports the detail provided by the backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve('{"detail":"No rights"}'),
      }),
    );

    await expect(send("PUT", "/api/x", "update x", "token", {})).rejects.toThrow(
      "Failed to update x (403 Forbidden): No rights",
    );
  });
});
