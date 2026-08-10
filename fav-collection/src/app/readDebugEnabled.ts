export function readDebugEnabled(search: string): boolean {
  return new URLSearchParams(search).get("debug") === "true";
}
