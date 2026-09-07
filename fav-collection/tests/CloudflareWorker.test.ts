import { describe, expect, it, vi } from "vitest";
import {
  handleRequest,
  type WorkerEnvironment,
} from "../cloudflare/worker";
import { type EnsurePostsFreshResult } from "../cloudflare/backend/post-cache-coordinator";
import { type PublicPost } from "../cloudflare/backend/post-transform";
import { type OAuthTokenState } from "../cloudflare/backend/oauth-token-store";

function validPosts(id = "post-1"): PublicPost[] {
  return [
    {
      id,
      authorName: "作者",
      authorHandle: "@author",
      text: "本文",
      mediaType: "image",
      media: [
        {
          type: "image",
          src: "https://example.invalid/image.jpg",
          alt: "説明",
        },
      ],
      viewCount: 10,
      likeCount: 2,
      repostCount: 1,
    },
  ];
}

type TestEnvironment = WorkerEnvironment & {
  initializeTokenState: ReturnType<
    typeof vi.fn<(token: OAuthTokenState) => Promise<void>>
  >;
  syncPostsIfStale: ReturnType<
    typeof vi.fn<(hasUsablePosts: boolean) => Promise<EnsurePostsFreshResult>>
  >;
};

function environmentWith(
  storedValue: string | null,
  coordinatorResult: EnsurePostsFreshResult = { outcome: "fresh" },
): TestEnvironment {
  const initializeTokenState = vi.fn(async () => undefined);
  const syncPostsIfStale = vi.fn(async () => coordinatorResult);
  return {
    POSTS_STORE: {
      get: vi.fn().mockResolvedValue(storedValue),
      put: vi.fn().mockResolvedValue(undefined),
    },
    OAUTH_TOKEN_COORDINATOR: {
      getByName: vi.fn(() => ({ initializeTokenState, syncPostsIfStale })),
    },
    POSTS_COORDINATOR_NAME: "test-coordinator",
    ASSETS: {
      fetch: vi.fn().mockResolvedValue(new Response("asset", { status: 200 })),
    },
    initializeTokenState,
    syncPostsIfStale,
  };
}

describe("Cloudflare Worker", () => {
  it("returns a validated posts array from the expected KV key", async () => {
    const environment = environmentWith(JSON.stringify(validPosts()));
    const response = await handleRequest(
      new Request("https://example.invalid/api/posts"),
      environment,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(validPosts());
    expect(environment.POSTS_STORE.get).toHaveBeenCalledWith(
      "posts:current",
      "text",
    );
    expect(environment.OAUTH_TOKEN_COORDINATOR.getByName).toHaveBeenCalledWith(
      "test-coordinator",
    );
    expect(environment.syncPostsIfStale).toHaveBeenCalledWith(true);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("returns the newly synchronized snapshot without relying on a KV reread", async () => {
    const latestPosts = validPosts("latest-post");
    const environment = environmentWith(JSON.stringify(validPosts()), {
      outcome: "synchronized",
      syncResult: {
        fetchedCount: 1,
        savedCount: 1,
        skippedCount: 0,
        posts: latestPosts,
      },
    });

    const response = await handleRequest(
      new Request("https://example.invalid/api/posts"),
      environment,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(latestPosts);
    expect(environment.POSTS_STORE.get).toHaveBeenCalledOnce();
  });

  it("initializes the selected Durable Object from a temporary secret", async () => {
    const environment = environmentWith(JSON.stringify(validPosts()));
    const tokenState = createTokenState();
    const authorizationKey = crypto.randomUUID();
    environment.OAUTH_TOKEN_BOOTSTRAP = JSON.stringify({
      authorizationKey,
      token: tokenState,
    });

    const response = await handleRequest(
      new Request(
        "https://example.invalid/api/internal/oauth-token-initialization",
        {
          method: "POST",
          headers: { "X-Fuv-Token-Initialization-Key": authorizationKey },
        },
      ),
      environment,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("x-fuv-token-initialized")).toBe("1");
    expect(environment.initializeTokenState).toHaveBeenCalledWith(tokenState);
    expect(environment.syncPostsIfStale).not.toHaveBeenCalled();
  });

  it("does not expose or accept an invalid temporary token secret", async () => {
    const internalValue = crypto.randomUUID();
    const environment = environmentWith(JSON.stringify(validPosts()));
    const authorizationKey = crypto.randomUUID();
    environment.OAUTH_TOKEN_BOOTSTRAP = JSON.stringify({
      authorizationKey,
      token: { accessToken: internalValue },
    });

    const response = await handleRequest(
      new Request(
        "https://example.invalid/api/internal/oauth-token-initialization",
        {
          method: "POST",
          headers: { "X-Fuv-Token-Initialization-Key": authorizationKey },
        },
      ),
      environment,
    );
    const body = await response.text();

    expect(response.status).toBe(409);
    expect(response.headers.get("x-fuv-token-initialized")).toBeNull();
    expect(environment.initializeTokenState).not.toHaveBeenCalled();
    expect(body).not.toContain(internalValue);
  });

  it("does not overwrite an already initialized Durable Object", async () => {
    const environment = environmentWith(JSON.stringify(validPosts()));
    const authorizationKey = crypto.randomUUID();
    environment.OAUTH_TOKEN_BOOTSTRAP = JSON.stringify({
      authorizationKey,
      token: createTokenState(),
    });
    environment.initializeTokenState.mockRejectedValue(
      new Error("already initialized"),
    );

    const response = await handleRequest(
      new Request(
        "https://example.invalid/api/internal/oauth-token-initialization",
        {
          method: "POST",
          headers: { "X-Fuv-Token-Initialization-Key": authorizationKey },
        },
      ),
      environment,
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("x-fuv-token-initialized")).toBeNull();
    expect(environment.syncPostsIfStale).not.toHaveBeenCalled();
  });

  it("hides the initialization route without the temporary secret and key", async () => {
    const environment = environmentWith(JSON.stringify(validPosts()));

    const response = await handleRequest(
      new Request(
        "https://example.invalid/api/internal/oauth-token-initialization",
        { method: "POST" },
      ),
      environment,
    );

    expect(response.status).toBe(404);
    expect(environment.initializeTokenState).not.toHaveBeenCalled();
  });

  it("rejects a wrong initialization key without touching Token storage", async () => {
    const environment = environmentWith(JSON.stringify(validPosts()));
    environment.OAUTH_TOKEN_BOOTSTRAP = JSON.stringify({
      authorizationKey: crypto.randomUUID(),
      token: createTokenState(),
    });

    const response = await handleRequest(
      new Request(
        "https://example.invalid/api/internal/oauth-token-initialization",
        {
          method: "POST",
          headers: {
            "X-Fuv-Token-Initialization-Key": crypto.randomUUID(),
          },
        },
      ),
      environment,
    );

    expect(response.status).toBe(404);
    expect(environment.initializeTokenState).not.toHaveBeenCalled();
  });

  it.each<[
    string,
    EnsurePostsFreshResult,
  ]>([
    ["retry wait", { outcome: "retry_wait" }],
    [
      "sync failure",
      { outcome: "sync_failed", failureKind: "x_api_request" },
    ],
  ])("returns the existing snapshot during %s", async (_label, result) => {
    const cachedPosts = validPosts("cached-post");
    const environment = environmentWith(JSON.stringify(cachedPosts), result);

    const response = await handleRequest(
      new Request("https://example.invalid/api/posts"),
      environment,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(cachedPosts);
  });

  it("returns synchronized Posts on the first request when KV was empty", async () => {
    const latestPosts = validPosts("first-post");
    const environment = environmentWith(null, {
      outcome: "synchronized",
      syncResult: {
        fetchedCount: 1,
        savedCount: 1,
        skippedCount: 0,
        posts: latestPosts,
      },
    });

    const response = await handleRequest(
      new Request("https://example.invalid/api/posts"),
      environment,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(latestPosts);
    expect(environment.syncPostsIfStale).toHaveBeenCalledWith(false);
  });

  it("keeps the existing 503 response when KV is empty and sync fails", async () => {
    const environment = environmentWith(null, {
      outcome: "sync_failed",
      failureKind: "oauth_refresh",
    });

    const response = await handleRequest(
      new Request("https://example.invalid/api/posts"),
      environment,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Posts unavailable" });
    expect(environment.syncPostsIfStale).toHaveBeenCalledWith(false);
  });

  it("returns the existing snapshot when the coordinator RPC fails", async () => {
    const cachedPosts = validPosts("cached-post");
    const environment = environmentWith(JSON.stringify(cachedPosts));
    environment.syncPostsIfStale.mockRejectedValue(
      new Error("internal coordinator detail"),
    );

    const response = await handleRequest(
      new Request("https://example.invalid/api/posts"),
      environment,
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(body)).toEqual(cachedPosts);
    expect(body).not.toContain("internal coordinator detail");
  });

  it("rejects non-GET requests without reading KV", async () => {
    const environment = environmentWith(JSON.stringify(validPosts()));
    const response = await handleRequest(
      new Request("https://example.invalid/api/posts", { method: "POST" }),
      environment,
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expect(environment.POSTS_STORE.get).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown API route", async () => {
    const environment = environmentWith(JSON.stringify(validPosts()));
    const response = await handleRequest(
      new Request("https://example.invalid/api/unknown"),
      environment,
    );

    expect(response.status).toBe(404);
    expect(environment.POSTS_STORE.get).not.toHaveBeenCalled();
  });

  it("delegates non-API requests to Static Assets", async () => {
    const environment = environmentWith(null);
    const request = new Request("https://example.invalid/");
    const response = await handleRequest(request, environment);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset");
    expect(environment.ASSETS.fetch).toHaveBeenCalledWith(request);
  });

  it.each([
    ["missing value", null],
    ["invalid JSON", "not-json"],
    ["empty array", "[]"],
    [
      "unexpected post field",
      JSON.stringify([{ ...validPosts()[0], privateValue: "excluded" }]),
    ],
    ["duplicate ID", JSON.stringify([...validPosts(), ...validPosts()])],
    [
      "more than the X API fetch limit",
      JSON.stringify(
        Array.from({ length: 101 }, (_value, index) => ({
          ...validPosts()[0],
          id: `post-${index}`,
        })),
      ),
    ],
  ])("returns a generic 503 for %s", async (_label, storedValue) => {
    const environment = environmentWith(storedValue);
    const response = await handleRequest(
      new Request("https://example.invalid/api/posts"),
      environment,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Posts unavailable" });
  });

  it("does not expose a KV exception in the response", async () => {
    const environment = environmentWith(null);
    vi.mocked(environment.POSTS_STORE.get).mockRejectedValue(
      new Error("internal storage detail"),
    );

    const response = await handleRequest(
      new Request("https://example.invalid/api/posts"),
      environment,
    );
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toBe('{"error":"Posts unavailable"}');
    expect(body).not.toContain("internal storage detail");
  });
});

function createTokenState(): OAuthTokenState {
  const currentTime = Date.now();
  return {
    userId: "123456789",
    accessToken: crypto.randomUUID(),
    refreshToken: crypto.randomUUID(),
    tokenType: "bearer",
    scope: "tweet.read users.read like.read offline.access",
    expiresAt: new Date(currentTime + 60 * 60 * 1000).toISOString(),
    savedAt: new Date(currentTime).toISOString(),
  };
}
