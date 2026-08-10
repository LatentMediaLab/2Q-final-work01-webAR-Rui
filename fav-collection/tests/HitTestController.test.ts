import { describe, expect, it, vi } from "vitest";
import { HitTestController } from "../src/ar/HitTestController";

describe("HitTestController", () => {
  it("uses the first valid hit and cancels the source on dispose", async () => {
    const pose = { transform: { matrix: new Float32Array(16) } } as XRPose;
    const referenceSpace = {} as XRReferenceSpace;
    const source = { cancel: vi.fn() } as unknown as XRHitTestSource;
    const result = {
      getPose: vi.fn().mockReturnValue(pose),
    } as unknown as XRHitTestResult;
    const session = {
      requestReferenceSpace: vi.fn().mockResolvedValue({}),
      requestHitTestSource: vi.fn().mockResolvedValue(source),
    } as unknown as XRSession;
    const frame = {
      getHitTestResults: vi.fn().mockReturnValue([result]),
    } as unknown as XRFrame;
    const controller = new HitTestController();

    await controller.initialize(session, referenceSpace);
    expect(controller.update(frame)).toBe(pose);

    controller.dispose();
    expect(source.cancel).toHaveBeenCalledOnce();
  });

  it("returns null when there is no hit", async () => {
    const source = { cancel: vi.fn() } as unknown as XRHitTestSource;
    const session = {
      requestReferenceSpace: vi.fn().mockResolvedValue({}),
      requestHitTestSource: vi.fn().mockResolvedValue(source),
    } as unknown as XRSession;
    const frame = {
      getHitTestResults: vi.fn().mockReturnValue([]),
    } as unknown as XRFrame;
    const controller = new HitTestController();

    await controller.initialize(session, {} as XRReferenceSpace);
    expect(controller.update(frame)).toBeNull();
  });
});
