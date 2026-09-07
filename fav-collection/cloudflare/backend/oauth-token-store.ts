export interface OAuthTokenState {
  userId: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scope?: string;
  expiresAt?: string;
  savedAt: string;
}

export interface OAuthTokenStore {
  read(): Promise<OAuthTokenState>;
  write(token: OAuthTokenState): Promise<void>;
}

export interface OAuthTokenKvNamespace {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export class OAuthTokenStoreError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "OAuthTokenStoreError";
  }
}

export function createKvOAuthTokenStore(
  namespace: OAuthTokenKvNamespace,
  key: string,
): OAuthTokenStore {
  if (key.trim() === "") {
    throw new OAuthTokenStoreError("OAuth tokenの保存キーが不正です。");
  }

  return {
    async read(): Promise<OAuthTokenState> {
      let source: string | null;
      try {
        source = await namespace.get(key, "text");
      } catch {
        throw new OAuthTokenStoreError("OAuth tokenを読み込めませんでした。");
      }
      if (source === null) {
        throw new OAuthTokenStoreError("OAuth tokenが登録されていません。");
      }

      let token: unknown;
      try {
        token = JSON.parse(source);
      } catch {
        throw new OAuthTokenStoreError("OAuth token保存データが不正です。");
      }
      validateOAuthTokenState(token);
      return token;
    },

    async write(token: OAuthTokenState): Promise<void> {
      validateOAuthTokenState(token);
      try {
        await namespace.put(key, JSON.stringify(token));
      } catch {
        throw new OAuthTokenStoreError("OAuth tokenを保存できませんでした。");
      }
    },
  };
}

export function validateOAuthTokenState(
  token: unknown,
): asserts token is OAuthTokenState {
  if (!isRecord(token) || !hasOnlyTokenFields(token)) {
    throw new OAuthTokenStoreError("OAuth token保存データが不正です。");
  }
  if (
    !isXUserId(token.userId) ||
    !isNonEmptyString(token.accessToken) ||
    !isNonEmptyString(token.refreshToken) ||
    !isNonEmptyString(token.tokenType) ||
    !isIsoDateTime(token.savedAt)
  ) {
    throw new OAuthTokenStoreError("OAuth token保存データが不正です。");
  }
  if (token.scope !== undefined && !isNonEmptyString(token.scope)) {
    throw new OAuthTokenStoreError("OAuth token保存データが不正です。");
  }
  if (token.expiresAt !== undefined && !isIsoDateTime(token.expiresAt)) {
    throw new OAuthTokenStoreError("OAuth token保存データが不正です。");
  }
}

const TOKEN_FIELDS = new Set([
  "userId",
  "accessToken",
  "refreshToken",
  "tokenType",
  "scope",
  "expiresAt",
  "savedAt",
]);

function hasOnlyTokenFields(token: Record<string, unknown>): boolean {
  return Object.keys(token).every((field) => TOKEN_FIELDS.has(field));
}

function isXUserId(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,19}$/.test(value);
}

function isIsoDateTime(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
