import { APP_CONFIG } from "../app/config";
import type { PostRepository } from "./PostRepository";
import type { PostRecord } from "./PostTypes";
import {
  validatePosts,
  type ValidationIssue,
} from "./validatePosts";

interface JsonResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

type FetchJson = (url: string) => Promise<JsonResponse>;
type ValidationIssueReporter = (issues: readonly ValidationIssue[]) => void;
type FallbackReporter = (error: unknown, fallbackUrl: string) => void;

interface JsonPostRepositoryOptions {
  url?: string;
  fallbackUrl?: string;
  fetchJson?: FetchJson;
  onValidationIssues?: ValidationIssueReporter;
  onFallback?: FallbackReporter;
}

const fetchJson: FetchJson = async (url) => fetch(url);

export class JsonPostRepository implements PostRepository {
  private readonly url: string;
  private readonly fallbackUrl: string | undefined;
  private readonly fetchJson: FetchJson;
  private readonly onValidationIssues: ValidationIssueReporter;
  private readonly onFallback: FallbackReporter;

  public constructor(options: JsonPostRepositoryOptions = {}) {
    this.url = options.url ?? APP_CONFIG.data.customPostsUrl;
    this.fallbackUrl = options.fallbackUrl;
    this.fetchJson = options.fetchJson ?? fetchJson;
    this.onValidationIssues = options.onValidationIssues ?? (() => undefined);
    this.onFallback = options.onFallback ?? (() => undefined);
  }

  public async getPosts(): Promise<PostRecord[]> {
    try {
      return await this.loadFrom(this.url);
    } catch (error: unknown) {
      if (this.fallbackUrl === undefined || this.fallbackUrl === this.url) {
        throw error;
      }

      this.onFallback(error, this.fallbackUrl);
      try {
        return await this.loadFrom(this.fallbackUrl);
      } catch (fallbackError: unknown) {
        throw new Error(
          "投稿データとプレースホルダー投稿データの取得に失敗しました。",
          { cause: fallbackError },
        );
      }
    }
  }

  private async loadFrom(url: string): Promise<PostRecord[]> {
    let response: JsonResponse;

    try {
      response = await this.fetchJson(url);
    } catch (cause: unknown) {
      throw new Error("投稿データの取得に失敗しました。", { cause });
    }

    if (!response.ok) {
      throw new Error(
        `投稿データの取得に失敗しました（HTTP ${response.status}）。`,
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (cause: unknown) {
      throw new Error("投稿JSONを解析できませんでした。", { cause });
    }

    const result = validatePosts(json);
    if (result.issues.length > 0) {
      this.onValidationIssues(result.issues);
    }

    return result.posts;
  }
}
