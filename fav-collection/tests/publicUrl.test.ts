import { describe, expect, it } from "vitest";
import { resolvePublicUrl } from "../src/utils/publicUrl";

describe("resolvePublicUrl", () => {
  it("keeps root-hosted paths unchanged", () => {
    expect(resolvePublicUrl("/assets/image.webp", "/")).toBe(
      "/assets/image.webp",
    );
  });

  it("prefixes local public files with a deployment base path", () => {
    expect(resolvePublicUrl("/assets/image.webp", "/fav-collection/")).toBe(
      "/fav-collection/assets/image.webp",
    );
  });

  it("does not add the same base path twice", () => {
    expect(
      resolvePublicUrl(
        "/fav-collection/assets/image.webp",
        "/fav-collection/",
      ),
    ).toBe("/fav-collection/assets/image.webp");
  });

  it("leaves external, protocol-relative, and relative URLs unchanged", () => {
    expect(resolvePublicUrl("https://example.com/image.webp", "/app/")).toBe(
      "https://example.com/image.webp",
    );
    expect(resolvePublicUrl("//cdn.example.com/image.webp", "/app/")).toBe(
      "//cdn.example.com/image.webp",
    );
    expect(resolvePublicUrl("assets/image.webp", "/app/")).toBe(
      "assets/image.webp",
    );
  });
});
