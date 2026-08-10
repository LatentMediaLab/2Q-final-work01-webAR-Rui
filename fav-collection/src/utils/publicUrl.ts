const configuredBaseUrl = import.meta.env.BASE_URL || "/";

export function resolvePublicUrl(
  value: string,
  baseUrl = configuredBaseUrl,
): string {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return value;
  }

  const normalizedBase = normalizeBaseUrl(baseUrl);
  if (normalizedBase === "/") {
    return value;
  }
  if (value === normalizedBase || value.startsWith(`${normalizedBase}/`)) {
    return value;
  }
  return `${normalizedBase}${value}`;
}

function normalizeBaseUrl(baseUrl: string): string {
  const path = baseUrl.startsWith("/") ? baseUrl : `/${baseUrl}`;
  const withoutTrailingSlash = path.replace(/\/+$/, "");
  return withoutTrailingSlash.length === 0 ? "/" : withoutTrailingSlash;
}
