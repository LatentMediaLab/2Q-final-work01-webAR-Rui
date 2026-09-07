import { refreshAccessToken } from "./oauth-refresh";
import {
  OAuthTokenStoreError,
  type OAuthTokenState,
  type OAuthTokenStore,
} from "./oauth-token-store";

export interface AccessTokenProvider {
  getValidAccessToken(): Promise<string>;
}

export type RefreshAccessToken = (options: {
  clientId: string;
  clientSecret: string;
  tokenStore: OAuthTokenStore;
  now?: () => number;
}) => Promise<OAuthTokenState>;

export class AccessTokenProviderConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AccessTokenProviderConfigError";
  }
}

export function createAccessTokenProvider({
  clientId,
  clientSecret,
  tokenStore,
  minimumValidityMs,
  refreshImplementation = refreshAccessToken,
  now = Date.now,
}: {
  clientId: string;
  clientSecret: string;
  tokenStore: OAuthTokenStore;
  minimumValidityMs: number;
  refreshImplementation?: RefreshAccessToken;
  now?: () => number;
}): AccessTokenProvider {
  validateMinimumValidity(minimumValidityMs);

  return {
    async getValidAccessToken(): Promise<string> {
      const currentTime = now();
      validateCurrentTime(currentTime, minimumValidityMs);

      let currentToken: OAuthTokenState;
      try {
        currentToken = await tokenStore.read();
      } catch {
        throw new OAuthTokenStoreError("OAuth tokenを読み込めませんでした。");
      }

      if (isValidFor(currentToken, currentTime, minimumValidityMs)) {
        return currentToken.accessToken;
      }

      const refreshedToken = await refreshImplementation({
        clientId,
        clientSecret,
        tokenStore,
        now: () => currentTime,
      });
      if (!isNonEmptyString(refreshedToken.accessToken)) {
        throw new OAuthTokenStoreError("更新したOAuth tokenが不正です。");
      }
      return refreshedToken.accessToken;
    },
  };
}

function isValidFor(
  token: OAuthTokenState,
  currentTime: number,
  minimumValidityMs: number,
): boolean {
  if (token.expiresAt === undefined) {
    return false;
  }
  const expiresAt = Date.parse(token.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt >= currentTime + minimumValidityMs;
}

function validateMinimumValidity(minimumValidityMs: number): void {
  if (
    !Number.isSafeInteger(minimumValidityMs) ||
    minimumValidityMs < 0
  ) {
    throw new AccessTokenProviderConfigError(
      "Access Tokenの最低残存時間が不正です。",
    );
  }
}

function validateCurrentTime(
  currentTime: number,
  minimumValidityMs: number,
): void {
  if (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(currentTime + minimumValidityMs)
  ) {
    throw new AccessTokenProviderConfigError("現在時刻を取得できませんでした。");
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
