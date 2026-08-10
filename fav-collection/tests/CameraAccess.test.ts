import { describe, expect, it, vi } from "vitest";
import {
  canUseCameraFallback,
  getCameraErrorMessage,
  getCameraErrorKind,
  requestRearCamera,
  stopMediaStream,
} from "../src/ar/CameraAccess";

describe("camera fallback access", () => {
  it("detects whether getUserMedia is available", () => {
    expect(canUseCameraFallback(undefined)).toBe(false);
    expect(
      canUseCameraFallback({ getUserMedia: vi.fn() } as unknown as MediaDevices),
    ).toBe(true);
  });

  it("requests the rear camera without audio", async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const mediaDevices = { getUserMedia } as unknown as MediaDevices;

    await expect(requestRearCamera(mediaDevices)).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
  });

  it("stops every camera track", () => {
    const stopVideo = vi.fn();
    const stopAudio = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopVideo }, { stop: stopAudio }],
    } as unknown as MediaStream;

    stopMediaStream(stream);

    expect(stopVideo).toHaveBeenCalledOnce();
    expect(stopAudio).toHaveBeenCalledOnce();
  });

  it("gives an actionable permission error", () => {
    expect(
      getCameraErrorMessage(new DOMException("denied", "NotAllowedError")),
    ).toContain("HTTPS");
    expect(
      getCameraErrorKind(new DOMException("denied", "NotAllowedError")),
    ).toBe("permission");
  });

  it("distinguishes a missing camera device", () => {
    expect(
      getCameraErrorKind(new DOMException("missing", "NotFoundError")),
    ).toBe("not-found");
  });
});
