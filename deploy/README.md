# Deploy game.man.ovh

The game runs as a separate Docker Compose service on the existing Docker network shared with Caddy. Caddy terminates HTTPS and reverse-proxies `game.man.ovh` to `game-server:3000`.

## Confirm the Caddy network

On the server, inspect the running Caddy container:

```sh
docker inspect "$(docker ps -q --filter name=caddy)" --format '{{range $name, $network := .NetworkSettings.Networks}}{{println $name}}{{end}}'
```

Use the exact network name in an untracked `.env` file beside `docker-compose.yml`:

```sh
cp .env.example .env
```

Set `CADDY_NETWORK` to the inspected name. Do not guess or create a different external network; Caddy must be attached to it too.

## Deploy the container

Copy this project to a dedicated directory such as `/opt/game.man.ovh`, set `.env`, then run:

```sh
docker compose up -d --build
docker compose logs -f game-server
```

The Compose service exposes port 3000 only inside Docker and has no host-published port.

## Caddy and DNS

Create an A record for `game.man.ovh` pointing to `130.136.3.17`. Append the block from [`Caddyfile`](Caddyfile) to the active host file `/opt/caddy/conf/Caddyfile`:

```caddy
game.man.ovh {
    encode zstd gzip
    reverse_proxy game-server:3000
}
```

Keep the existing `finance.man.ovh` and `erik.man.ovh` blocks unchanged. Validate and reload the running Caddy container using its actual name and mounted config path, for example:

```sh
docker exec caddy caddy validate --config /etc/caddy/Caddyfile
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

After DNS resolves, Caddy will serve HTTPS for the new host. Room state is in memory; container restarts end active games.
