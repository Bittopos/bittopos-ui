# Bittopos Web

Static single-page application built with HTML, CSS, and native ES modules. License: Mozilla Public License 2.0 (MPL-2.0).

The app communicates with the Bittopos Rust API. Configure the API origin in the frontend's deployment settings/code before deploying it to Cloudflare Pages. Do not treat client-side checks as an authorization boundary; the server must enforce authentication and project isolation.

## Local checks

```bash
npm run check
```

Serve this directory using any static HTTP server. Configure the API's allowed `WEB_ORIGIN` to match the frontend origin during development.

## Cloudflare Pages

This repository is a static site with no bundler at present:
- Build command: leave empty.
- Build output directory: `/` (repository root).
- Production API URL: configure separately from the static frontend; do not commit credentials.

## Current limitations

The UI and API adapter are experimental. The backend's current authentication is a single-admin development barrier, with no per-project permissions or dedicated CSRF defense. Do not expose it as a production multi-user service until the server security work is completed.
