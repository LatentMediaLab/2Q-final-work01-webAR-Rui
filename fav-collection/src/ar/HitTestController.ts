export class HitTestController {
  private hitTestSource: XRHitTestSource | null = null;
  private referenceSpace: XRReferenceSpace | null = null;

  public async initialize(
    session: XRSession,
    referenceSpace: XRReferenceSpace,
  ): Promise<void> {
    this.dispose();
    const viewerSpace = await session.requestReferenceSpace("viewer");
    const requestHitTestSource = session.requestHitTestSource;
    if (requestHitTestSource === undefined) {
      throw new Error("WebXR Hit Test API is unavailable.");
    }

    const source = await requestHitTestSource.call(session, {
      space: viewerSpace,
    });
    if (source === undefined) {
      throw new Error("WebXR Hit Test source could not be created.");
    }

    this.referenceSpace = referenceSpace;
    this.hitTestSource = source;
  }

  public update(frame: XRFrame): XRPose | null {
    if (this.hitTestSource === null || this.referenceSpace === null) {
      return null;
    }

    const result = frame.getHitTestResults(this.hitTestSource)[0];
    return result?.getPose(this.referenceSpace) ?? null;
  }

  public dispose(): void {
    this.hitTestSource?.cancel();
    this.hitTestSource = null;
    this.referenceSpace = null;
  }
}
