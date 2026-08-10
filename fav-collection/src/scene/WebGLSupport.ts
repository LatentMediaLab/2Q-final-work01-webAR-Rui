export type WebGLContextProbe = () => unknown;

export function isWebGLAvailable(
  probe: WebGLContextProbe = createBrowserContext,
): boolean {
  try {
    return probe() !== null;
  } catch {
    return false;
  }
}

function createBrowserContext(): unknown {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  context?.getExtension("WEBGL_lose_context")?.loseContext();
  return context;
}
