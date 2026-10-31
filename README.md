# Who Is Most Likely To?

A bilingual party game for a shared screen and players' phones. Rooms are temporary, with no accounts or database.

## Development

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. The Vite client proxies Socket.IO to the Node server on port `3001`.

## Checks

```sh
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

## Deployment

Docker/Caddy setup and the required external network variable are described in [`deploy/README.md`](deploy/README.md). Do not replace the existing Caddy configuration.
