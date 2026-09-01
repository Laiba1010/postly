# Postly

Multi-tenant social media scheduling & publishing platform.

## Prerequisites

- Node.js 20 LTS
- pnpm
- Docker Desktop

## Setup

\`\`\`
docker compose up -d
pnpm install
pnpm dev
\`\`\`

- Frontend: http://localhost:3000
- Backend: http://localhost:4000/api/health

## Environment

Copy \`.env.example\` to \`.env\` in both \`apps/api\` and \`.env.local\` in \`apps/web\`.
