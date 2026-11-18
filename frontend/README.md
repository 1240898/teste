# LaPrizza SPA

The frontend serves every website role from one application. The browser calls the LaPrizza REST API at `/api/v1`. The API owns business data and permissions.

## Run locally

1. Use the Node.js version in [`.nvmrc`](.nvmrc). Install npm dependencies with `npm ci`.
2. Copy `.env.example` to `.env` in this directory.
3. Follow the [repository setup](../README.md) for PostgreSQL, back-end configuration and migrations. Start the back end on port 8080.
4. Run `npm run dev` from `frontend/` and open `http://localhost:5173`. Check that the status below the header shows **Ligado ao servidor** or **Connected to the server**.

The default frontend origin is `http://localhost:5173`. Set the back end's `CORS_ORIGIN` to the exact frontend origin and, when Google sign-in is configured, register `<SPA origin>/auth/callback/google` as `GOOGLE_REDIRECT_URI`. Use the same host name for the browser and API during local development. Mixing `127.0.0.1` and `localhost` can prevent the browser from sending the session cookie.

## Public configuration

| Setting | Development | Test | Production and staging |
| --- | --- | --- | --- |
| `VITE_BACKEND_BASE_URL` | `http://localhost:8080/api/v1` by default | Same default in Jest | Required for deployment. Use `/api/v1` behind a same-origin reverse proxy, or an absolute HTTPS URL ending in `/api/v1` on the same site. HTTP is accepted for loopback hosts for local builds. |
| `VITE_API_TIMEOUT_MS` | Defaults to `15000` | Defaults to `15000` | Optional positive integer in milliseconds. |
| `VITE_DEV_SERVER_PORT` | Defaults to `5173` | — | — |

The base URL accepts no query, fragment, embedded credentials or trailing slash. Production values are fixed at build time. Supply them through the build environment or `.env.production.local`. All `VITE_*` settings are public. Keep database, session-signing, Google client and AI service secrets in the corresponding server environment.

## Test and build

```sh
npm ci
npm run lint
npm test -- --runInBand
npm --prefix ../backend ci
npm run test:integration
```

The integration test starts the repository's Express app on a temporary port and checks the actual health response and CORS headers. It does not require PostgreSQL. The SPA tests exercise React Router and the shared API client using controlled HTTP responses.

After copying `.env.example` to `.env`, `npm run build` uses the local API at `http://localhost:8080/api/v1`. For a deployed build, set `VITE_BACKEND_BASE_URL` to `/api/v1` behind a same-origin reverse proxy or to an absolute HTTPS API URL ending in `/api/v1`. A missing production API base fails the build. The bundle scan catches known server-only credential names and private-key markers.

```sh
npm run build
npm run check:bundle
```

## Serve the production bundle

Serve `dist/` over HTTPS for production. The current SYS01 interim deployment is HTTP-only and must stay restricted to the intended DEI network/VPN; Google sign-in is unavailable there until HTTPS is configured. Route `/api/v1/` to the API before applying the SPA fallback. Rewrite frontend navigation paths such as `/register` and `/auth/callback/google` to `index.html`, preserving the URL and query. Serve generated assets directly and return 404 for missing assets. Revalidate `index.html` and allow long-lived caching of the hashed assets.

For example, with the real upstream supplied by SYS01:

```nginx
location ^~ /api/v1/ {
    proxy_pass http://laprizza_api;
}
location ^~ /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
}
location = /index.html {
    add_header Cache-Control "no-cache";
}
location / {
    try_files $uri $uri/ /index.html;
}
```

For final deployment verification, open and reload `/register`, visit an unknown frontend route, confirm the fallback page stays inside the shell, and verify that `/api/v1/health` returns JSON. Then check the Google callback and cookie-backed session restoration over the deployed HTTPS origin when HTTPS is configured. Vite preview can check the bundle and router locally. SYS01 verifies the actual reverse proxy and hosting configuration.

## Integrate a module

The shared router mounts module components under the common shell and checks the Table 1 roles before loading their code. Register a real dynamic import in the `modules` prop of `App` once its component and API contract are ready. The supported keys and paths are defined in [`moduleRoutes.js`](src/app/navigation/moduleRoutes.js).

A loaded component receives `request(method, path, { body, query, signal })` bound to the confirmed session. Implement endpoint-specific calls as thin adapters using that function. Paths are relative to `/api/v1`, dynamic path segments use `encodeURIComponent`, and identifiers and DTO field values retain their original meaning. Routes without a loader are absent from the menu and router. WEB03 should consume the same route policy when assembling the full menu.

See the [WEB01 design and validation record](../docs/user_stories/web01/usWEB01.md) for acceptance evidence, client clarifications and open integration contracts. For the Three.js viewer, see the [VIS01 implementation and manual checks](src/visualization/README.md).
