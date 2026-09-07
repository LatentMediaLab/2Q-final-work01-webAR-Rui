import {
  validatePostsSnapshot,
  type PublicPost,
} from "./backend/post-transform";
import {
  validateOAuthTokenState,
  type OAuthTokenState,
} from "./backend/oauth-token-store";
import {
  type EnsurePostsFreshResult,
} from "./backend/post-cache-coordinator";
import {
  MAX_POSTS_SNAPSHOT_SIZE,
  POSTS_CURRENT_KEY,
  type PostsKvNamespace,
} from "./backend/posts-kv-store";

export { OAuthTokenDurableObject } from "./backend/oauth-token-durable-object";


interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface PostsCoordinatorStub {
  initializeTokenState(token: OAuthTokenState): Promise<void>;
  syncPostsIfStale(hasUsablePosts: boolean): Promise<EnsurePostsFreshResult>;
}

interface PostsCoordinatorNamespace {
  getByName(name: string): PostsCoordinatorStub;
}

const TOKEN_INITIALIZATION_PATH = "/api/internal/oauth-token-initialization";
const TOKEN_INITIALIZATION_KEY_HEADER = "X-Fuv-Token-Initialization-Key";

export interface WorkerEnvironment {
  POSTS_STORE: PostsKvNamespace;
  OAUTH_TOKEN_COORDINATOR: PostsCoordinatorNamespace;
  OAUTH_TOKEN_BOOTSTRAP?: string;
  POSTS_COORDINATOR_NAME?: string;
  ASSETS: AssetsBinding;
}

function isValidPosts(value: unknown): value is PublicPost[] {
  if (!Array.isArray(value) || value.length > MAX_POSTS_SNAPSHOT_SIZE) {
    return false;
  }
  try {
    validatePostsSnapshot(value);
    return true;
  } catch {
    return false;
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'",
      "Content-Type": "application/json; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function readStoredPosts(
  environment: WorkerEnvironment,
): Promise<PublicPost[] | null> {
  const storedValue = await environment.POSTS_STORE.get(
    POSTS_CURRENT_KEY,
    "text",
  );
  if (storedValue === null) {
    return null;
  }
  const posts: unknown = JSON.parse(storedValue);
  return isValidPosts(posts) ? posts : null;
}

function readCoordinatorName(environment: WorkerEnvironment): string {
  const name = environment.POSTS_COORDINATOR_NAME?.trim();
  if (name === undefined || name.length === 0) {
    throw new Error("Post coordinator is not configured.");
  }
  return name;
}

async function handleTokenInitialization(
  request: Request,
  environment: WorkerEnvironment,
): Promise<Response> {
  const source = environment.OAUTH_TOKEN_BOOTSTRAP;
  if (source === undefined) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(source);
  } catch {
    return jsonResponse({ error: "Not found" }, 404);
  }
  if (!isTokenBootstrapEnvelope(envelope)) {
    return jsonResponse({ error: "Not found" }, 404);
  }
  const providedKey = request.headers.get(TOKEN_INITIALIZATION_KEY_HEADER);
  if (
    request.method !== "POST" ||
    providedKey === null ||
    providedKey.length !== envelope.authorizationKey.length ||
    !(await securelyMatches(providedKey, envelope.authorizationKey))
  ) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  try {
    const coordinator = environment.OAUTH_TOKEN_COORDINATOR.getByName(
      readCoordinatorName(environment),
    );
    const token = envelope.token;
    validateOAuthTokenState(token);
    await coordinator.initializeTokenState(token);
    const response = new Response(null, { status: 204 });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Fuv-Token-Initialized", "1");
    return response;
  } catch {
    return jsonResponse({ error: "Token initialization failed" }, 409);
  }
}

function isTokenBootstrapEnvelope(
  value: unknown,
): value is { authorizationKey: string; token: unknown } {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 2 &&
    typeof record.authorizationKey === "string" &&
    record.authorizationKey.length >= 32 &&
    "token" in record
  );
}

async function securelyMatches(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export async function handleRequest(
  request: Request,
  environment: WorkerEnvironment,
): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (!pathname.startsWith("/api/")) {
    return environment.ASSETS.fetch(request);
  }
  if (pathname === TOKEN_INITIALIZATION_PATH) {
    return handleTokenInitialization(request, environment);
  }
  if (pathname !== "/api/posts") {
    return jsonResponse({ error: "Not found" }, 404);
  }
  if (request.method !== "GET") {
    const response = jsonResponse({ error: "Method not allowed" }, 405);
    response.headers.set("Allow", "GET");
    return response;
  }

  let storedPosts: PublicPost[] | null = null;
  try {
    storedPosts = await readStoredPosts(environment);
  } catch {
    // A valid synchronized result can still satisfy the request if KV cannot be read.
  }

  try {
    const coordinator = environment.OAUTH_TOKEN_COORDINATOR.getByName(
      readCoordinatorName(environment),
    );
    const result = await coordinator.syncPostsIfStale(storedPosts !== null);
    if (
      result.outcome === "synchronized" &&
      isValidPosts(result.syncResult.posts)
    ) {
      return jsonResponse(result.syncResult.posts, 200);
    }
  } catch {
    // Stale-while-error: keep serving the last validated snapshot when available.
  }

  return storedPosts === null
    ? jsonResponse({ error: "Posts unavailable" }, 503)
    : jsonResponse(storedPosts, 200);
}

export default {
  fetch: handleRequest,
};
