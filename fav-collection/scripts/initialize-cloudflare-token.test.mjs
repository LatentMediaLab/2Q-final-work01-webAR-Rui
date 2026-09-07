import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseArguments,
  readTargetConfiguration,
  runTokenInitialization,
  TokenInitializationError,
  validateTokenSource,
} from "./initialize-cloudflare-token.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("Cloudflare OAuth Token initialization script", () => {
  it("requires an explicit environment and HTTPS Worker origin", () => {
    expect(() => parseArguments([])).toThrow(TokenInitializationError);
    expect(() =>
      parseArguments([
        "--environment",
        "staging",
        "--worker-url",
        "http://example.invalid",
      ]),
    ).toThrow(TokenInitializationError);

    const options = parseArguments([
      "--environment",
      "production",
      "--worker-url",
      "https://example.invalid",
    ]);
    expect(options.environment).toBe("production");
    expect(options.workerUrl.origin).toBe("https://example.invalid");
  });

  it("validates the local OAuth file without exposing its values", () => {
    expect(() => validateTokenSource(JSON.stringify(createTokenState()))).not.toThrow();
    expect(() =>
      validateTokenSource(
        JSON.stringify({ accessToken: crypto.randomUUID() }),
      ),
    ).toThrow(TokenInitializationError);
  });

  it("rejects an unset Durable Object name", async () => {
    const directory = await createTemporaryDirectory();
    const configPath = join(directory, "wrangler.jsonc");
    await writeFile(
      configPath,
      JSON.stringify({
        env: {
          staging: {
            name: "worker-staging",
            vars: { POSTS_COORDINATOR_NAME: "SET_A_STABLE_COORDINATOR_NAME" },
          },
        },
      }),
    );

    await expect(
      readTargetConfiguration(configPath, "staging"),
    ).rejects.toBeInstanceOf(TokenInitializationError);
  });

  it("uploads through stdin, confirms initialization, and removes the temporary secret", async () => {
    const directory = await createTemporaryDirectory();
    const configPath = join(directory, "wrangler.jsonc");
    const tokenPath = join(directory, "x-oauth-tokens.json");
    const tokenState = createTokenState();
    await writeFile(
      configPath,
      JSON.stringify({
        env: {
          staging: {
            name: "worker-staging",
            vars: { POSTS_COORDINATOR_NAME: "coordinator-staging" },
          },
        },
      }),
    );
    await writeFile(tokenPath, JSON.stringify(tokenState), { mode: 0o600 });
    const runWrangler = vi.fn(async () => undefined);
    const fetchImplementation = vi.fn(async () =>
      new Response(null, {
        status: 204,
        headers: { "X-Fuv-Token-Initialized": "1" },
      }),
    );

    await runTokenInitialization(
      {
        environment: "staging",
        workerUrl: new URL("https://example.invalid"),
        tokenFile: tokenPath,
        config: configPath,
      },
      {
        fetchImplementation,
        promptImplementation: async () => true,
        runWranglerImplementation: runWrangler,
      },
    );

    expect(runWrangler).toHaveBeenCalledTimes(2);
    expect(runWrangler.mock.calls[0]?.[0]).toContain("put");
    const uploadedEnvelope = JSON.parse(runWrangler.mock.calls[0]?.[1]);
    expect(uploadedEnvelope.token).toEqual(tokenState);
    expect(typeof uploadedEnvelope.authorizationKey).toBe("string");
    expect(uploadedEnvelope.authorizationKey.length).toBeGreaterThanOrEqual(32);
    expect(runWrangler.mock.calls[1]?.[0]).toContain("bulk");
    expect(JSON.parse(runWrangler.mock.calls[1]?.[1])).toEqual({
      OAUTH_TOKEN_BOOTSTRAP: null,
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      new URL(
        "https://example.invalid/api/internal/oauth-token-initialization",
      ),
      {
        method: "POST",
        headers: {
          "X-Fuv-Token-Initialization-Key":
            uploadedEnvelope.authorizationKey,
        },
        redirect: "error",
      },
    );
  });

  it("removes the temporary secret even when initialization cannot be confirmed", async () => {
    const directory = await createTemporaryDirectory();
    const configPath = join(directory, "wrangler.jsonc");
    const tokenPath = join(directory, "x-oauth-tokens.json");
    await writeFile(
      configPath,
      JSON.stringify({
        env: {
          production: {
            name: "worker-production",
            vars: { POSTS_COORDINATOR_NAME: "coordinator-production" },
          },
        },
      }),
    );
    await writeFile(tokenPath, JSON.stringify(createTokenState()), { mode: 0o600 });
    const runWrangler = vi.fn(async () => undefined);

    await expect(
      runTokenInitialization(
        {
          environment: "production",
          workerUrl: new URL("https://example.invalid"),
          tokenFile: tokenPath,
          config: configPath,
        },
        {
          fetchImplementation: async () => new Response(null),
          promptImplementation: async () => true,
          runWranglerImplementation: runWrangler,
          waitImplementation: async () => undefined,
        },
      ),
    ).rejects.toThrow(
      "Durable Objectの初期化完了を確認できませんでした（HTTP 200）。",
    );

    expect(runWrangler).toHaveBeenCalledTimes(2);
    expect(runWrangler.mock.calls[1]?.[0]).toContain("bulk");
  });

  it("retries a temporary 404 while the Worker Secret deployment propagates", async () => {
    const directory = await createTemporaryDirectory();
    const configPath = join(directory, "wrangler.jsonc");
    const tokenPath = join(directory, "x-oauth-tokens.json");
    await writeFile(
      configPath,
      JSON.stringify({
        env: {
          staging: {
            name: "worker-staging",
            vars: { POSTS_COORDINATOR_NAME: "coordinator-staging" },
          },
        },
      }),
    );
    await writeFile(tokenPath, JSON.stringify(createTokenState()), { mode: 0o600 });
    const runWrangler = vi.fn(async () => undefined);
    const waitImplementation = vi.fn(async () => undefined);
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: { "X-Fuv-Token-Initialized": "1" },
        }),
      );

    await runTokenInitialization(
      {
        environment: "staging",
        workerUrl: new URL("https://example.invalid"),
        tokenFile: tokenPath,
        config: configPath,
      },
      {
        fetchImplementation,
        promptImplementation: async () => true,
        runWranglerImplementation: runWrangler,
        waitImplementation,
      },
    );

    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(waitImplementation).toHaveBeenCalledWith(2_000);
  });
});

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "fuv-token-init-"));
  temporaryDirectories.push(directory);
  return directory;
}

function createTokenState() {
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
