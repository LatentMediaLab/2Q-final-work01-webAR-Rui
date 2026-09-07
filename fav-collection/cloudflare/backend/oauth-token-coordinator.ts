import {
  createAccessTokenProvider,
  type RefreshAccessToken,
} from "./access-token-provider";
import { refreshAccessToken } from "./oauth-refresh";
import {
  OAuthTokenStoreError,
  type OAuthTokenState,
} from "./oauth-token-store";
import { type InitializableOAuthTokenStore } from "./durable-object-token-store";

export const MINIMUM_ACCESS_TOKEN_VALIDITY_MS = 5 * 60 * 1000;

export class OAuthTokenCoordinator {
  readonly #clientId: string;
  readonly #clientSecret: string;
  readonly #tokenStore: InitializableOAuthTokenStore;
  readonly #refreshImplementation: RefreshAccessToken;
  readonly #now: () => number;
  #refreshPromise: Promise<OAuthTokenState> | null = null;

  public constructor({
    clientId,
    clientSecret,
    tokenStore,
    refreshImplementation = refreshAccessToken,
    now = Date.now,
  }: {
    clientId: string;
    clientSecret: string;
    tokenStore: InitializableOAuthTokenStore;
    refreshImplementation?: RefreshAccessToken;
    now?: () => number;
  }) {
    this.#clientId = clientId;
    this.#clientSecret = clientSecret;
    this.#tokenStore = tokenStore;
    this.#refreshImplementation = refreshImplementation;
    this.#now = now;
  }

  public async initializeTokenState(token: OAuthTokenState): Promise<void> {
    const initialized = await this.#tokenStore.initialize(token);
    if (!initialized) {
      throw new OAuthTokenStoreError("OAuth tokenはすでに初期化されています。");
    }
  }

  public async getValidAccessToken(): Promise<string> {
    const provider = createAccessTokenProvider({
      clientId: this.#clientId,
      clientSecret: this.#clientSecret,
      tokenStore: this.#tokenStore,
      minimumValidityMs: MINIMUM_ACCESS_TOKEN_VALIDITY_MS,
      refreshImplementation: (options) => this.#refreshOnce(options),
      now: this.#now,
    });
    return provider.getValidAccessToken();
  }

  #refreshOnce(
    options: Parameters<RefreshAccessToken>[0],
  ): Promise<OAuthTokenState> {
    if (this.#refreshPromise === null) {
      this.#refreshPromise = this.#refreshImplementation(options).finally(() => {
        this.#refreshPromise = null;
      });
    }
    return this.#refreshPromise;
  }
}
