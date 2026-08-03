# IIIT social

## Web Push deployment

Set `DATABASE_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`
in Vercel. Generate the VAPID pair with `npx web-push generate-vapid-keys`, set
`PUSH_ENABLED=true`, and optionally set `PUSH_ALLOWED_ORIGINS` to a comma-separated
list of additional application origins.

Run `npm run db:setup` once after pulling `DATABASE_URL` to create the Neon push
tables. The live kill switch is the `push_settings` row with key `enabled`: set its
value to `0` to disable delivery, or delete the row to fall back to `PUSH_ENABLED`.
After this deployment is live, remove the legacy Upstash/KV variables and integration
from Vercel.

IIIT social is a simple, elegant, and secure web client for Matrix communities, with end-to-end encryption support.

## Development

Use Node.js 24 LTS or a compatible version listed in `.node-version`.

```sh
npm ci
npm start
```

The Vite development server runs on port `8080`. Build the production bundle with:

```sh
npm run build
npm run preview
```

Run validation before merging:

```sh
npm run typecheck
npm run lint
```

## Deployment

The `dev` branch is used for active development and Vercel Preview deployments. Merge to `main` only when a change is ready for production; Vercel serves `main` as the production deployment.
UI options are developed on the `ui-options` branch.

## Self-hosting

The production bundle is written to `dist/` and can be served by any static web server. The default homeservers and featured Matrix communities are configured in [`config.json`](config.json). For reverse-proxy examples, see [`contrib/nginx/matrix-iiit.domain.tld.conf`](contrib/nginx/matrix-iiit.domain.tld.conf) and [`contrib/caddy/caddyfile`](contrib/caddy/caddyfile).

To run the Docker image locally after building it:

```sh
docker build -t iiit-matrix:latest .
docker run -p 8080:80 iiit-matrix:latest
```

The project is licensed under AGPL-3.0; see [`LICENSE`](LICENSE).
