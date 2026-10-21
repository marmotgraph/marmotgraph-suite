import { getJson } from "./http";

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
