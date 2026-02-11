# Ray2Clash

A Cloudflare Worker that converts V2Ray subscription links (vmess, vless, trojan, ss) into Clash configuration files. 

## Features

- Supports `vmess://`, `vless://`, `trojan://`, and `ss://` protocols.
- Generates a complete Clash config with `PROXY`, `Auto` (url-test), and `Fallback` groups.
- Standard rule sets for Google, GitHub, and CN GeoIP.
- Runs entirely on Cloudflare Workers (Serverless).

## Deployment

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Login to Cloudflare:**
   ```bash
   npx wrangler login
   ```

3. **Deploy:**
   ```bash
   npx wrangler deploy
   ```

## Usage

After deployment, your worker will be available at `https://ray2clash.<your-subdomain>.workers.dev`.

To convert a subscription, append your subscription URL as a query parameter:

```
https://ray2clash.<your-subdomain>.workers.dev/?url=YOUR_V2RAY_SUBSCRIPTION_LINK
```

Example:
```
https://ray2clash.example.workers.dev/?url=https://example.com/sub/123456
```

This will download a `clash-config.yaml` file that you can import directly into Clash for Windows, ClashX, or other compatible clients.

## Development

To run locally:
```bash
npm start
```

To run tests:
```bash
npm test
```
