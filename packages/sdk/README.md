# Karakeep SDK

This package contains the official TypeScript SDK for the Karakeep API.

## Install

```bash
npm install @karakeep/sdk
```

## Usage

```ts
import { createKarakeepClient } from "@karakeep/sdk";

const apiKey = "my-super-secret-key";
const addr = "https://karakeep.mydomain.com";

const client = createKarakeepClient({
  baseUrl: `${addr}/api/v1/`,
  headers: {
    "Content-Type": "application/json",
    authorization: `Bearer ${apiKey}`,
  },
});

const { data: createdBookmark, error: createError } = await client.POST(
  "/bookmarks",
  {
    body: {
      type: "text",
      title: "Search Test 1",
      text: "This is a test bookmark for search",
    },
  },
);

console.log(createdBookmark, createError);
```

## Docs

- API reference: <https://docs.karakeep.app/api>

## Versioning

- The SDK tracks Karakeep’s minor server version.
- New API surface from Karakeep `0.x.y` becomes available in the SDK starting from the matching minor line.
- Karakeep aims to keep older SDK versions broadly usable against newer server versions when compatibility allows.
