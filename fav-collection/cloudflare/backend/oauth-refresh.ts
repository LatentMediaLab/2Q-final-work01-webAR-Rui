import {
  OAuthTokenStoreError,
  type OAuthTokenState,
  type OAuthTokenStore,
} from "./oauth-token-store";

const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const REQUEST_TIMEOUT_MS = 20_000;

interface JsonResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type OAuthFetch = (
  input: string,
  init?: RequestInit,
) => Promise<JsonResponse>;

export class OAuthRefreshConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "OAuthRefreshConfigError";
  }
}

export class OAuthRefreshRequestError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "OAuthRefreshRequestError";
  }
}

export async function refreshAccessToken({
  clientId,
  clientSecret,
  tokenStore,
  fetchImplementation = fetch,
  now = Date.now,
}: {
  clientId: string;
  clientSecret: string;
  tokenStore: OAuthTokenStore;
  fetchImplementation?: OAuthFetch;
  now?: () => number;
}): Promise<OAuthTokenState> {
  validateClientCredentials(clientId, clientSecret);
  let currentToken: OAuthTokenState;
  try {
    currentToken = await tokenStore.read();
  } catch {
    throw new OAuthTokenStoreError("OAuth tokenを読み込めませんでした。");
  }
  const responseBody = await requestRefreshedToken({
    clientId,
    clientSecret,
    refreshToken: currentToken.refreshToken,
    fetchImplementation,
  });
  const refreshedToken = buildRefreshedToken(currentToken, responseBody, now());

  try {
    await tokenStore.write(refreshedToken);
  } catch {
    throw new OAuthTokenStoreError("更新したOAuth tokenを保存できませんでした。");
  }
  return refreshedToken;
}

async function requestRefreshedToken({
  clientId,
  clientSecret,
  refreshToken,
  fetchImplementation,
}: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImplementation: OAuthFetch;
}): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  let response: JsonResponse;

  try {
    response = await fetchImplementation(X_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new OAuthRefreshRequestError(
      "X OAuthのToken endpointへ接続できませんでした。",
    );
  }

  if (!response.ok) {
    throw new OAuthRefreshRequestError(
      `X OAuth tokenの更新に失敗しました（HTTP ${response.status}）。`,
    );
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new OAuthRefreshRequestError(
      "X OAuth tokenの更新応答をJSONとして解析できませんでした。",
    );
  }
  if (!isRecord(responseBody)) {
    throw new OAuthRefreshRequestError("X OAuth tokenの更新応答が不正です。");
  }
  return responseBody;
}

function buildRefreshedToken(
  currentToken: OAuthTokenState,
  responseBody: Record<string, unknown>,
  currentTime: number,
): OAuthTokenState {
  if (!Number.isFinite(currentTime)) {
    throw new OAuthRefreshConfigError("現在時刻を取得できませんでした。");
  }
  if (!isNonEmptyString(responseBody.access_token)) {
    throw new OAuthRefreshRequestError(
      "X OAuth tokenの更新応答にAccess Tokenが含まれていません。",
    );
  }

  const refreshToken = readOptionalString(
    responseBody,
    "refresh_token",
    currentToken.refreshToken,
  );
  const tokenType = readOptionalString(
    responseBody,
    "token_type",
    currentToken.tokenType,
  );
  const scope = readOptionalString(responseBody, "scope", currentToken.scope);
  const expiresAt = readExpiresAt(responseBody, currentTime);

  return {
    userId: currentToken.userId,
    accessToken: responseBody.access_token,
    refreshToken,
    tokenType,
    ...(scope === undefined ? {} : { scope }),
    ...(expiresAt === undefined ? {} : { expiresAt }),
    savedAt: new Date(currentTime).toISOString(),
  };
}

function readOptionalString(
  responseBody: Record<string, unknown>,
  field: string,
  fallback: string,
): string;
function readOptionalString(
  responseBody: Record<string, unknown>,
  field: string,
  fallback: string | undefined,
): string | undefined;
function readOptionalString(
  responseBody: Record<string, unknown>,
  field: string,
  fallback: string | undefined,
): string | undefined {
  const value = responseBody[field];
  if (value === undefined) {
    return fallback;
  }
  if (!isNonEmptyString(value)) {
    throw new OAuthRefreshRequestError("X OAuth tokenの更新応答が不正です。");
  }
  return value;
}

function readExpiresAt(
  responseBody: Record<string, unknown>,
  currentTime: number,
): string | undefined {
  const expiresIn = responseBody.expires_in;
  if (expiresIn === undefined) {
    return undefined;
  }
  if (
    typeof expiresIn !== "number" ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new OAuthRefreshRequestError("X OAuth tokenの更新応答が不正です。");
  }
  return new Date(currentTime + expiresIn * 1000).toISOString();
}

function validateClientCredentials(clientId: string, clientSecret: string): void {
  if (clientId.trim() === "") {
    throw new OAuthRefreshConfigError("X_OAUTH_CLIENT_IDが設定されていません。");
  }
  if (clientSecret.trim() === "") {
    throw new OAuthRefreshConfigError(
      "X_OAUTH_CLIENT_SECRETが設定されていません。",
    );
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
