# Shop Inventory Router

Central Node.js service that handles WhatsApp communication via Green API, routes messages to the correct shop's plugin, and manages user authentication.

## What This Does

- Connects to Green API (incoming webhooks + outgoing messages)
- Manages phone-to-shop registry (which phone belongs to which shop)
- Handles phone verification flow
- Uses AI for natural language conversation (future)
- Calls plugin REST APIs to get/modify shop data
- Formats data for WhatsApp messages
- Controls premium/free feature access

## Stack

- Node.js 20+
- TypeScript
- Fastify 5
- Green API (WhatsApp)
- AI service via LangChain or Vercel AI SDK (future)
- Vitest (testing)

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Documentation

Full documentation in the root `docs/` folder:

- [Full Project Spec](../docs/full-project-spec.md)
- [Architecture](../docs/architecture.md)
