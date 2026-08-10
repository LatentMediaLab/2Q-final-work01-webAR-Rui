import { APP_CONFIG } from "./config";

export function readPostsDataUrl(search: string): string {
  const parameters = new URLSearchParams(search);
  const requestedData = parameters.get(APP_CONFIG.routing.dataParameter);

  if (requestedData === APP_CONFIG.routing.sampleDataValue) {
    return APP_CONFIG.data.postsUrl;
  }
  if (requestedData === APP_CONFIG.routing.placeholderDataValue) {
    return APP_CONFIG.data.placeholderPostsUrl;
  }
  return APP_CONFIG.data.customPostsUrl;
}
