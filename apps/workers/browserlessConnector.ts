export function buildBrowserlessWebSocketUrl(
  baseUrl: string,
  token: string | undefined,
): string {
  if (!token) {
    throw new Error(
      "BROWSERLESS_TOKEN is required when BROWSERLESS_URL is set",
    );
  }
  const url = new URL(baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function redactBrowserConnectionUrl(connectionUrl: string): string {
  const url = new URL(connectionUrl);
  if (url.searchParams.has("token")) {
    url.searchParams.set("token", "redacted");
  }
  url.username = "";
  url.password = "";
  return url.toString();
}
