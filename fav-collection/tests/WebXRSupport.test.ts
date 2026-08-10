import { describe, expect, it, vi } from "vitest";
import { checkImmersiveArSupport } from "../src/ar/WebXRSupport";

describe("checkImmersiveArSupport", () => {
  it("reports unsupported when navigator.xr is absent", async () => {
    await expect(checkImmersiveArSupport(undefined)).resolves.toBe(
      "unsupported",
    );
  });

  it("checks immersive-ar support", async () => {
    const isSessionSupported = vi.fn().mockResolvedValue(true);
    const xr = { isSessionSupported } as unknown as XRSystem;

    await expect(checkImmersiveArSupport(xr)).resolves.toBe("supported");
    expect(isSessionSupported).toHaveBeenCalledWith("immersive-ar");
  });

  it("does not throw when the support check rejects", async () => {
    const xr = {
      isSessionSupported: vi.fn().mockRejectedValue(new Error("blocked")),
    } as unknown as XRSystem;

    await expect(checkImmersiveArSupport(xr)).resolves.toBe("error");
  });
});
