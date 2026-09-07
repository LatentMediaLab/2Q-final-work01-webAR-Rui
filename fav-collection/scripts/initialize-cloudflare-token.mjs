import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const INITIAL_TOKEN_SECRET_NAME = "OAUTH_TOKEN_BOOTSTRAP";
const INITIALIZED_HEADER_NAME = "x-fuv-token-initialized";
const INITIALIZATION_KEY_HEADER_NAME = "X-Fuv-Token-Initialization-Key";
const INITIALIZATION_PATH = "/api/internal/oauth-token-initialization";
const INITIALIZATION_REQUEST_ATTEMPTS = 12;
const INITIALIZATION_RETRY_DELAY_MS = 2_000;
const DEFAULT_CONFIG_PATH = fileURLToPath(
  new URL("../wrangler.jsonc", import.meta.url),
);
const DEFAULT_TOKEN_FILE_PATH = fileURLToPath(
  new URL("../../fav-collection-ec/.local/x-oauth-tokens.json", import.meta.url),
);
const WRANGLER_ENTRY_PATH = fileURLToPath(
  new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);

export class TokenInitializationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TokenInitializationError";
  }
}

export function parseArguments(arguments_) {
  const options = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--help") {
      return { help: true };
    }
    if (!["--environment", "--worker-url", "--token-file", "--config"].includes(argument)) {
      throw new TokenInitializationError("初期化スクリプトの引数が不正です。");
    }
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new TokenInitializationError("初期化スクリプトの引数が不足しています。");
    }
    const key = argument.slice(2).replaceAll(/-([a-z])/g, (_match, letter) =>
      letter.toUpperCase(),
    );
    if (options[key] !== undefined) {
      throw new TokenInitializationError("初期化スクリプトの引数が重複しています。");
    }
    options[key] = value;
    index += 1;
  }

  if (!["staging", "production"].includes(options.environment)) {
    throw new TokenInitializationError(
      "--environmentにはstagingまたはproductionを明示してください。",
    );
  }
  if (options.workerUrl === undefined) {
    throw new TokenInitializationError("--worker-urlを明示してください。");
  }
  return {
    help: false,
    environment: options.environment,
    workerUrl: validateWorkerUrl(options.workerUrl),
    tokenFile: resolve(options.tokenFile ?? DEFAULT_TOKEN_FILE_PATH),
    config: resolve(options.config ?? DEFAULT_CONFIG_PATH),
  };
}

export function validateTokenSource(source) {
  let token;
  try {
    token = JSON.parse(source);
  } catch {
    throw new TokenInitializationError("OAuth Token保存ファイルが不正です。");
  }
  if (!isRecord(token) || !hasOnlyTokenFields(token)) {
    throw new TokenInitializationError("OAuth Token保存ファイルが不正です。");
  }
  if (
    !/^\d{1,19}$/.test(token.userId) ||
    !isNonEmptyString(token.accessToken) ||
    !isNonEmptyString(token.refreshToken) ||
    !isNonEmptyString(token.tokenType) ||
    !isIsoDateTime(token.expiresAt) ||
    !isIsoDateTime(token.savedAt) ||
    (token.scope !== undefined && !isNonEmptyString(token.scope))
  ) {
    throw new TokenInitializationError("OAuth Token保存ファイルが不正です。");
  }
}

export async function readTargetConfiguration(configPath, environment) {
  let config;
  try {
    config = JSON.parse(await readFile(configPath, "utf8"));
  } catch {
    throw new TokenInitializationError("Wrangler設定を読み込めませんでした。");
  }
  const target = config?.env?.[environment];
  const workerName = target?.name;
  const coordinatorName = target?.vars?.POSTS_COORDINATOR_NAME;
  if (
    !isNonEmptyString(workerName) ||
    !isNonEmptyString(coordinatorName) ||
    coordinatorName.startsWith("SET_")
  ) {
    throw new TokenInitializationError(
      "対象環境のWorker名またはPOSTS_COORDINATOR_NAMEが未設定です。",
    );
  }
  return { workerName, coordinatorName };
}

export async function runTokenInitialization(
  options,
  {
    fetchImplementation = fetch,
    promptImplementation = promptForConfirmation,
    runWranglerImplementation = runWrangler,
    waitImplementation = wait,
  } = {},
) {
  const target = await readTargetConfiguration(
    options.config,
    options.environment,
  );
  const confirmation = `${options.environment}:${target.workerName}:${target.coordinatorName}`;
  const confirmed = await promptImplementation({
    ...target,
    environment: options.environment,
    workerUrl: options.workerUrl.origin,
    confirmation,
  });
  if (!confirmed) {
    throw new TokenInitializationError("対象環境の確認が一致しませんでした。");
  }

  let temporarySecretCreated = false;
  let cleanupFailed = false;
  let operationError;
  try {
    const tokenSource = await readPrivateTokenFile(options.tokenFile);
    validateTokenSource(tokenSource);
    const authorizationKey = randomBytes(32).toString("base64url");
    await runWranglerImplementation(
      [
        "secret",
        "put",
        INITIAL_TOKEN_SECRET_NAME,
        "--config",
        options.config,
        "--env",
        options.environment,
      ],
      JSON.stringify({ authorizationKey, token: JSON.parse(tokenSource) }),
    );
    temporarySecretCreated = true;

    const response = await requestTokenInitialization({
      workerUrl: options.workerUrl,
      authorizationKey,
      fetchImplementation,
      waitImplementation,
    });
    if (
      response.status !== 204 ||
      response.headers.get(INITIALIZED_HEADER_NAME) !== "1"
    ) {
      throw new TokenInitializationError(
        `Durable Objectの初期化完了を確認できませんでした（HTTP ${response.status}）。`,
      );
    }
  } catch (error) {
    operationError =
      error instanceof TokenInitializationError
        ? error
        : new TokenInitializationError("OAuth Token初期登録に失敗しました。");
  } finally {
    if (temporarySecretCreated) {
      try {
        await runWranglerImplementation(
          [
            "secret",
            "bulk",
            "--config",
            options.config,
            "--env",
            options.environment,
          ],
          JSON.stringify({ [INITIAL_TOKEN_SECRET_NAME]: null }),
        );
      } catch {
        cleanupFailed = true;
      }
    }
  }

  if (cleanupFailed) {
    throw new TokenInitializationError(
      "初期化後に一時Secretを削除できませんでした。手動削除が必要です。",
    );
  }
  if (operationError !== undefined) {
    throw operationError;
  }
}

async function requestTokenInitialization({
  workerUrl,
  authorizationKey,
  fetchImplementation,
  waitImplementation,
}) {
  for (let attempt = 1; attempt <= INITIALIZATION_REQUEST_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetchImplementation(
        new URL(INITIALIZATION_PATH, workerUrl),
        {
          method: "POST",
          headers: { [INITIALIZATION_KEY_HEADER_NAME]: authorizationKey },
          redirect: "error",
        },
      );
    } catch {
      throw new TokenInitializationError(
        "Workerへ初期化要求を送信できませんでした。",
      );
    }
    if (
      response.status !== 404 ||
      attempt === INITIALIZATION_REQUEST_ATTEMPTS
    ) {
      return response;
    }
    await waitImplementation(INITIALIZATION_RETRY_DELAY_MS);
  }
  throw new TokenInitializationError(
    "Workerへ初期化要求を送信できませんでした。",
  );
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

async function readPrivateTokenFile(tokenFile) {
  try {
    const metadata = await stat(tokenFile);
    if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) {
      throw new TokenInitializationError(
        "OAuth Token保存ファイルのアクセス権限が安全ではありません。",
      );
    }
    return await readFile(tokenFile, "utf8");
  } catch (error) {
    if (error instanceof TokenInitializationError) {
      throw error;
    }
    throw new TokenInitializationError(
      "OAuth Token保存ファイルを読み込めませんでした。",
    );
  }
}

async function promptForConfirmation(target) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(`対象環境: ${target.environment}`);
    console.log(`Worker: ${target.workerName}`);
    console.log(`Durable Object名: ${target.coordinatorName}`);
    console.log(`Worker URL: ${target.workerUrl}`);
    const answer = await terminal.question(
      `続行するには「${target.confirmation}」と入力してください: `,
    );
    return answer.trim() === target.confirmation;
  } finally {
    terminal.close();
  }
}

function runWrangler(arguments_, standardInput) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [WRANGLER_ENTRY_PATH, ...arguments_],
      { stdio: ["pipe", "inherit", "inherit"] },
    );
    child.once("error", () => {
      rejectPromise(new TokenInitializationError("Wranglerを実行できませんでした。"));
    });
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new TokenInitializationError("Wrangler処理に失敗しました。"));
      }
    });
    child.stdin.once("error", () => {
      rejectPromise(new TokenInitializationError("Wranglerへ入力を渡せませんでした。"));
    });
    child.stdin.end(standardInput);
  });
}

function validateWorkerUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TokenInitializationError("Worker URLが不正です。");
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new TokenInitializationError(
      "Worker URLにはHTTPSのoriginだけを指定してください。",
    );
  }
  return url;
}

function hasOnlyTokenFields(token) {
  const fields = new Set([
    "userId",
    "accessToken",
    "refreshToken",
    "tokenType",
    "scope",
    "expiresAt",
    "savedAt",
  ]);
  return Object.keys(token).every((field) => fields.has(field));
}

function isIsoDateTime(value) {
  return (
    isNonEmptyString(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function printUsage() {
  console.log(
    "Usage: npm run cloudflare:token:init -- --environment <staging|production> --worker-url <https-origin> [--token-file <path>] [--config <path>]",
  );
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      printUsage();
      return;
    }
    await runTokenInitialization(options);
    console.log("Durable ObjectへのOAuth Token初期登録が完了しました。");
  } catch (error) {
    const message =
      error instanceof TokenInitializationError
        ? error.message
        : "OAuth Token初期登録に失敗しました。";
    console.error(message);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
