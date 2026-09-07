import {
  OAuthTokenStoreError,
  validateOAuthTokenState,
  type OAuthTokenState,
  type OAuthTokenStore,
} from "./oauth-token-store";

const TOKEN_STATE_KEY = "oauth:token-state";

export interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export interface InitializableOAuthTokenStore extends OAuthTokenStore {
  initialize(token: OAuthTokenState): Promise<boolean>;
}

export function createDurableObjectOAuthTokenStore(
  storage: DurableObjectStorageLike,
): InitializableOAuthTokenStore {
  return {
    async read(): Promise<OAuthTokenState> {
      let token: unknown;
      try {
        token = await storage.get<unknown>(TOKEN_STATE_KEY);
      } catch {
        throw new OAuthTokenStoreError("OAuth tokenを読み込めませんでした。");
      }
      if (token === undefined) {
        throw new OAuthTokenStoreError("OAuth tokenが登録されていません。");
      }
      validateOAuthTokenState(token);
      return token;
    },

    async write(token: OAuthTokenState): Promise<void> {
      validateOAuthTokenState(token);
      try {
        await storage.put(TOKEN_STATE_KEY, token);
      } catch {
        throw new OAuthTokenStoreError("OAuth tokenを保存できませんでした。");
      }
    },

    async initialize(token: OAuthTokenState): Promise<boolean> {
      validateOAuthTokenState(token);
      let currentToken: unknown;
      try {
        currentToken = await storage.get<unknown>(TOKEN_STATE_KEY);
        if (currentToken !== undefined) {
          return false;
        }
        await storage.put(TOKEN_STATE_KEY, token);
        return true;
      } catch {
        throw new OAuthTokenStoreError("OAuth tokenを初期化できませんでした。");
      }
    },
  };
}
