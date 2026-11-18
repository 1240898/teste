const LOCAL_API = 'http://localhost:8080/api/v1';

export function readAppConfig(env) {
  const baseUrl = env.VITE_BACKEND_BASE_URL ?? (env.PROD ? '' : LOCAL_API);
  if (baseUrl !== '/api/v1') {
    let url;
    try {
      url = new URL(baseUrl);
    } catch {
      throw new Error('VITE_BACKEND_BASE_URL must be an API URL or /api/v1.');
    }
    const localHttpHosts = ['localhost', '127.0.0.1', '[::1]'];
    const isLocalHttp =
      url.protocol === 'http:' && localHttpHosts.includes(url.hostname);
    if (
      (env.PROD
        ? url.protocol !== 'https:' && !isLocalHttp
        : url.protocol !== 'https:' && url.protocol !== 'http:') ||
      url.pathname !== '/api/v1' ||
      url.username ||
      url.password ||
      baseUrl !== `${url.origin}/api/v1`
    ) {
      throw new Error(
        'VITE_BACKEND_BASE_URL must point to /api/v1 without credentials or query parameters.',
      );
    }
  }

  const timeoutMs = Number(env.VITE_API_TIMEOUT_MS ?? 15000);
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 2147483647
  ) {
    throw new Error(
      'VITE_API_TIMEOUT_MS must be a positive timer value in milliseconds.',
    );
  }

  return Object.freeze({ apiBaseUrl: baseUrl, apiTimeoutMs: timeoutMs });
}

let config;

export function getAppConfig() {
  // Read named values only. Passing all of import.meta.env to another function
  // would expose every VITE_ variable to the generated bundle.
  config ??= readAppConfig({
    PROD: import.meta.env.PROD === true,
    VITE_BACKEND_BASE_URL: import.meta.env.VITE_BACKEND_BASE_URL,
    VITE_API_TIMEOUT_MS: import.meta.env.VITE_API_TIMEOUT_MS,
  });
  return config;
}
