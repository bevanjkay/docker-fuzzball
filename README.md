# fuzzball-api

Minimal HTTP API wrapper around the [`fuzzball`](https://www.npmjs.com/package/fuzzball) package.

## Run with Docker Compose

Create a `docker-compose.yml` file:

```yaml
services:
  fuzzball-api:
    image: ghcr.io/bevanjkay/docker-fuzzball:latest
    ports:
      - "3000:3000"
    restart: unless-stopped
```

Start the service:

```bash
docker compose up -d
```

The API is now available at `http://localhost:3000`.

To update to the latest image:

```bash
docker compose pull
docker compose up -d
```

## Run with Docker

```bash
docker run --rm -p 3000:3000 ghcr.io/bevanjkay/docker-fuzzball:latest
```

Images are available for `linux/amd64` and `linux/arm64`. The `latest` and `main` tags track the default branch, while releases also publish semantic-version tags such as `1.2.3`, `1.2`, and `1`.

## API

- `GET /health`
- `GET /?a=<string>&b=<string>`
- `POST /extract`

### `GET /health`

Returns a simple health check response.

Success response:

```json
{
  "ok": true
}
```

### `GET /?a=<string>&b=<string>`

Returns the fuzzball ratio between two query string values.

Example request:

```bash
curl -s 'http://localhost:3000/?a=asdf&b=asdfasdf'
```

Success response:

```json
{
  "ratio": 67
}
```

Error response:

```json
{
  "error": "Query params \"a\" and \"b\" are required"
}
```

### `POST /extract`

Returns the best matching value from a dataset.

Request body:

```json
{
  "query": "string",
  "choices": ["string"],
  "cutoff": 80
}
```

```bash
curl -s 'http://localhost:3000/extract' \
  -H 'content-type: application/json' \
  -d '{
    "query": "appl",
    "choices": ["apple", "banana", "apply"],
    "cutoff": 80
  }'
```

Success response:

```json
{
  "choice": "apple",
  "score": 89
}
```

No-match response:

```json
{
  "choice": null,
  "score": null
}
```

Possible error responses:

```json
{
  "error": "Request body is required"
}
```

```json
{
  "error": "Request body must be valid JSON"
}
```

```json
{
  "error": "Body field \"query\" must be a non-empty string"
}
```

```json
{
  "error": "Body field \"choices\" must be a non-empty array of strings"
}
```

```json
{
  "error": "Body field \"cutoff\" must be a finite number from 0 to 100 when provided"
}
```

Requests to this endpoint must use `Content-Type: application/json`. Request bodies are limited to 1 MiB and `choices` to 10,000 items.

### Other responses

Unknown routes return:

```json
{
  "error": "Not found"
}
```

## Development

Install the dependencies and start the server locally:

```bash
npm ci
npm start
```

Run the checks:

```bash
npm run lint
npm run check
npm test
```
