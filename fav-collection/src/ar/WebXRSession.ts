export function createArSessionInit(overlayRoot: Element): XRSessionInit {
  return {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["local-floor", "dom-overlay", "anchors"],
    domOverlay: { root: overlayRoot },
  };
}

export function requestArSession(
  xr: XRSystem,
  overlayRoot: Element,
): Promise<XRSession> {
  return xr.requestSession(
    "immersive-ar",
    createArSessionInit(overlayRoot),
  );
}
