import type { RequestedMode } from "./AppState";
import { APP_CONFIG } from "./config";

export function readRequestedMode(search: string): RequestedMode {
  const parameters = new URLSearchParams(search);
  const requestedMode = parameters.get(APP_CONFIG.routing.modeParameter);

  return requestedMode === APP_CONFIG.routing.previewValue ? "preview" : null;
}
