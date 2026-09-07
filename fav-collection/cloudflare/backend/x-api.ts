const X_API_BASE_URL = "https://api.x.com/2";
const REQUEST_TIMEOUT_MS = 20_000;

export const DEFAULT_X_API_FETCH_LIMIT = 70;

const MIN_X_API_FETCH_LIMIT = 5;
const MAX_X_API_FETCH_LIMIT = 100;

export interface XApiEnvironment {
  X_API_USER_ID?: string;
  X_API_FETCH_LIMIT?: string;
}

export interface XApiRequestConfig {
  userId: string;
  maxResults: number;
}

interface JsonResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type XApiFetch = (
  input: URL,
  init?: RequestInit,
) => Promise<JsonResponse>;

export class XApiConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "XApiConfigError";
  }
}

export class XApiRequestError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "XApiRequestError";
  }
}

export class XApiResponseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "XApiResponseError";
  }
}

export function readXApiRequestConfig(
  environment: XApiEnvironment,
): XApiRequestConfig {
  const userId = environment.X_API_USER_ID?.trim();
  if (!userId || !/^\d{1,19}$/.test(userId)) {
    throw new XApiConfigError(
      "X_API_USER_IDには1文字から19文字の数字を指定してください。",
    );
  }

  return {
    userId,
    maxResults: readXApiFetchLimit(environment),
  };
}

export function readXApiFetchLimit(environment: XApiEnvironment): number {
  const configuredValue = environment.X_API_FETCH_LIMIT?.trim();
  if (!configuredValue) {
    return DEFAULT_X_API_FETCH_LIMIT;
  }

  const parsedValue = Number(configuredValue);
  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < MIN_X_API_FETCH_LIMIT ||
    parsedValue > MAX_X_API_FETCH_LIMIT
  ) {
    throw new XApiConfigError(
      `X_API_FETCH_LIMITには${MIN_X_API_FETCH_LIMIT}から${MAX_X_API_FETCH_LIMIT}までの整数を指定してください。`,
    );
  }
  return parsedValue;
}

export function buildXLikedPostsUrl(
  userId: string,
  maxResults = DEFAULT_X_API_FETCH_LIMIT,
): URL {
  if (!/^\d{1,19}$/.test(userId)) {
    throw new XApiConfigError(
      "X_API_USER_IDには1文字から19文字の数字を指定してください。",
    );
  }
  if (
    !Number.isInteger(maxResults) ||
    maxResults < MIN_X_API_FETCH_LIMIT ||
    maxResults > MAX_X_API_FETCH_LIMIT
  ) {
    throw new XApiConfigError(
      `取得件数には${MIN_X_API_FETCH_LIMIT}から${MAX_X_API_FETCH_LIMIT}までの整数を指定してください。`,
    );
  }

  const url = new URL(`${X_API_BASE_URL}/users/${userId}/liked_tweets`);
  url.searchParams.set("max_results", String(maxResults));
  url.searchParams.set(
    "tweet.fields",
    "attachments,author_id,created_at,public_metrics",
  );
  url.searchParams.set("expansions", "attachments.media_keys,author_id");
  url.searchParams.set(
    "media.fields",
    "alt_text,duration_ms,height,media_key,preview_image_url,type,url,variants,width",
  );
  url.searchParams.set(
    "user.fields",
    "id,name,profile_image_url,username",
  );
  return url;
}

export async function fetchXLikedPosts({
  accessToken,
  userId,
  maxResults = DEFAULT_X_API_FETCH_LIMIT,
  fetchImplementation = fetch,
}: {
  accessToken: string;
  userId: string;
  maxResults?: number;
  fetchImplementation?: XApiFetch;
}): Promise<Record<string, unknown>> {
  if (accessToken.trim() === "") {
    throw new XApiConfigError("X APIのUser Access Tokenが設定されていません。");
  }

  const url = buildXLikedPostsUrl(userId, maxResults);
  let response: JsonResponse;

  try {
    response = await fetchImplementation(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken.trim()}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new XApiRequestError("X APIへ接続できませんでした。");
  }

  if (!response.ok) {
    throw new XApiRequestError(
      `X APIから正常な応答を取得できませんでした（HTTP ${response.status}）。`,
    );
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new XApiResponseError(
      "X APIの応答をJSONとして解析できませんでした。",
    );
  }

  if (!isRecord(responseBody) || !Array.isArray(responseBody.data)) {
    throw new XApiResponseError("X APIの応答形式が不正です。");
  }

  return responseBody;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
