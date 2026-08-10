import { describe, expect, it } from "vitest";
import { JsonPostRepository } from "../src/data/JsonPostRepository";

describe("JsonPostRepository", () => {
  it("reports a JSON fetch failure", async () => {
    const repository = new JsonPostRepository({
      url: "/data/missing.json",
      fetchJson: async () => {
        throw new Error("network unavailable");
      },
    });

    await expect(repository.getPosts()).rejects.toThrow(
      "投稿データの取得に失敗しました。",
    );
  });

  it("loads placeholder posts when the custom JSON is unavailable", async () => {
    const requestedUrls: string[] = [];
    const repository = new JsonPostRepository({
      url: "/data/posts.custom.json",
      fallbackUrl: "/data/posts.placeholder.json",
      fetchJson: async (url) => {
        requestedUrls.push(url);
        if (url === "/data/posts.custom.json") {
          throw new Error("custom data unavailable");
        }
        return {
          ok: true,
          status: 200,
          json: async () => [createValidPost()],
        };
      },
    });

    await expect(repository.getPosts()).resolves.toHaveLength(1);
    expect(requestedUrls).toEqual([
      "/data/posts.custom.json",
      "/data/posts.placeholder.json",
    ]);
  });

  it("reports an error when custom and placeholder JSON are unavailable", async () => {
    const repository = new JsonPostRepository({
      url: "/data/posts.custom.json",
      fallbackUrl: "/data/posts.placeholder.json",
      fetchJson: async () => {
        throw new Error("network unavailable");
      },
    });

    await expect(repository.getPosts()).rejects.toThrow(
      "投稿データとプレースホルダー投稿データの取得に失敗しました。",
    );
  });
});

function createValidPost(): object {
  return {
    id: "placeholder-001",
    authorName: "Placeholder Author",
    authorHandle: "@placeholder",
    text: "プレースホルダー投稿",
    mediaType: "image",
    media: [
      {
        type: "image",
        src: "/assets/posts/image-placeholder.svg",
      },
    ],
  };
}
