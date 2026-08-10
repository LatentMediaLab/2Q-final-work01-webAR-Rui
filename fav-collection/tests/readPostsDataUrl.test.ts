import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "../src/app/config";
import { readPostsDataUrl } from "../src/app/readPostsDataUrl";

describe("readPostsDataUrl", () => {
  it("uses generated custom data by default", () => {
    expect(readPostsDataUrl("?mode=preview")).toBe(
      APP_CONFIG.data.customPostsUrl,
    );
  });

  it("uses placeholder data when data=placeholder is requested", () => {
    expect(readPostsDataUrl("?mode=preview&data=placeholder")).toBe(
      APP_CONFIG.data.placeholderPostsUrl,
    );
  });

  it("uses the smaller sample data when data=sample is requested", () => {
    expect(readPostsDataUrl("?mode=preview&data=sample")).toBe(
      APP_CONFIG.data.postsUrl,
    );
  });

  it("uses generated custom data when data=custom is requested", () => {
    expect(readPostsDataUrl("?mode=preview&data=custom")).toBe(
      APP_CONFIG.data.customPostsUrl,
    );
  });

  it("ignores unsupported data values", () => {
    expect(readPostsDataUrl("?data=unknown")).toBe(
      APP_CONFIG.data.customPostsUrl,
    );
  });
});
