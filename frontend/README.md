# BrewTracker frontend

React + TypeScript single-page app built with [Vite](https://vite.dev).

## Scripts

| Command                           | What it does                                             |
| --------------------------------- | -------------------------------------------------------- |
| `npm start`                       | Dev server on http://localhost:3000                      |
| `npm run build`                   | Production build to `build/` (assets in `build/static/`) |
| `npm run preview`                 | Serve the production build locally                       |
| `npm test` / `npm run coverage`   | Jest tests (jsdom)                                       |
| `npm run type-check`              | `tsc --noEmit`                                           |
| `npm run lint`                    | [Oxlint](https://oxc.rs/docs/guide/usage/linter)         |
| `npm run format` / `format:check` | Prettier                                                 |

## Environment variables

`REACT_APP_API_URL` and `REACT_APP_GOOGLE_CLIENT_ID` (see the root README).
Both `REACT_APP_` and `VITE_` prefixes are exposed to the client via
`envPrefix` in `vite.config.ts`; read them with `import.meta.env`.

## Requirements

Node >= 22.22 (react-router 8 is ESM-only).
