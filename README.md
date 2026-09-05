# Postly

Multi-tenant social media scheduling & publishing platform for small marketing and content teams.

Built as a portfolio case study demonstrating reliable asynchronous publishing architecture, multi-tenant workspace isolation, and production-oriented backend engineering — not just another CRUD dashboard.

---

## Tech Stack

**Frontend**

- Next.js (App Router) + React + TypeScript
- Tailwind CSS + shadcn/ui (Base UI primitives)
- TanStack Query (server state)
- Zustand (client UI state)
- React Hook Form + Zod

**Backend**

- Node.js + NestJS + TypeScript
- MongoDB (Mongoose) — replica set enabled for multi-document transactions
- Redis (ioredis) — sessions + future BullMQ queue storage
- `@node-rs/argon2` — password hashing (Argon2id, prebuilt native binary, no build-tools required)

**Infrastructure**

- Docker Compose (MongoDB + Redis, local dev)
- pnpm workspaces (monorepo: `apps/api`, `apps/web`)

---

## Prerequisites

- Node.js 20 LTS (Node 22 has known ESM/CJS compatibility issues with NestJS CLI tooling as of this build)
- pnpm
- Docker Desktop

---

## Setup

```bash
docker compose up -d
docker exec -it postly-mongodb mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})"
pnpm install
pnpm dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000/api/health

### Environment Configuration

Copy `.env.example` → `.env` in `apps/api`, and `.env.example` → `.env.local` in `apps/web`. Never commit `.env` or `.env.local` — only `.env.example` files are tracked in git.

Required backend variables:

```
NODE_ENV=development
PORT=4000
DATABASE_URL=mongodb://localhost:27017/postly?replicaSet=rs0
REDIS_URL=redis://localhost:6379
SESSION_SECRET=<32+ char random string>
TOKEN_ENCRYPTION_KEY=<32+ char random string>
CORS_ORIGIN=http://localhost:3000
```

Required frontend variables:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## What's Implemented So Far

### Phase 1 — Project Foundation ✅

- Monorepo (pnpm workspaces): `apps/api` (NestJS), `apps/web` (Next.js)
- Docker Compose: MongoDB (replica set enabled) + Redis, both with healthchecks
- Environment configuration with Joi validation at boot (`@nestjs/config`) — app refuses to start with missing/invalid required env vars
- MongoDB connection via Mongoose, Redis connection via ioredis
- `GET /api/health` — reports API, MongoDB, and Redis status individually (via `@nestjs/terminus`)
- Global API prefix (`/api`), CORS configured for the frontend origin
- Consistent global error contract via `AllExceptionsFilter` — every error returns `{ statusCode, code, message, path, timestamp }`
- ESLint + Prettier across both apps, root-level `pnpm dev` / `pnpm lint` / `pnpm format` scripts

### Phase 2 — Authentication ✅

- Signup, login, logout, `GET /auth/me`
- Passwords hashed with Argon2id (`@node-rs/argon2`)
- Sessions stored in Redis, **keyed by SHA-256 hash of the session token** (raw token never persisted — only the browser holds it, via HttpOnly cookie)
- Sliding session expiry (7 days, refreshed on each authenticated request)
- `AuthGuard` — resolves session → user, attaches to `request.user`, reusable across all future modules
- CSRF protection — `CsrfGuard` validates `Origin`/`Referer` header on all unsafe HTTP methods
- Rate limiting (`@nestjs/throttler`) — global baseline + stricter limits on auth endpoints (signup, login, forgot-password)
- Forgot password / reset password flow — reset tokens hashed (SHA-256) with TTL auto-expiry via MongoDB index; reset link is logged to the backend console in development (see Deviations)
- Frontend: signup/login forms (React Hook Form + Zod + shadcn `Field` pattern), TanStack Query `useCurrentUser()` hook, protected route layout, cross-links (Sign up ↔ Log in ↔ Forgot password) with corrected UX placement (forgot-password inline with the password field, not buried below unrelated links)

### Phase 3 — Workspace & RBAC ✅

- **Workspace** — create, list (scoped to the user's own memberships), get-by-id, rename (Owner-only)
- **Membership** — `User × Workspace → Role`, unique compound index prevents duplicate memberships
- Workspace creation is **atomic** (MongoDB transaction): workspace + OWNER membership are created together or not at all — no orphan workspaces possible
- **`WorkspaceGuard`** — every workspace-scoped route independently re-verifies membership server-side; a `workspaceId` in a URL is never trusted on its own
- **`RolesGuard` + `@Roles()` decorator** — layered on top of `WorkspaceGuard` for Owner-only operations (rename workspace, invite members, change roles, remove members)
- **Owner invariants enforced at the service layer**: exactly one Owner per workspace; Owner cannot remove or demote themselves; a workspace can never be left without an Owner
- **Invitations** — email + role based, token hashed (SHA-256, never stored in plaintext), 7-day expiry, single-use, duplicate-pending-invitation prevention via partial unique index, email-match enforcement on acceptance (prevents a forwarded link being claimed by the wrong account)
- **Invitation acceptance** — atomic (membership + invitation-accepted marked together in one transaction); idempotent if the user is already a member
- **Auto-accept UX** — clicking "Accept & sign up" or "Log in to accept" carries the invitation through the auth flow via a `redirect` + `autoAccept` query param, so the user is never asked to confirm the same action twice (except when a genuine email mismatch requires it)
- **Frontend**: workspace switcher (self-healing — silently recovers if `localStorage`'s cached active workspace becomes stale/invalid, rather than showing an error), Team page (member list, role changes, removal with destructive confirmation), workspace settings (Owner-editable, read-only for others), invite dialog, pending invitations list
- **`RoleControl`** — single shared component renders the Owner/Editor/Viewer pill consistently whether it's a static badge or an interactive dropdown, eliminating visual drift between read-only and editable states

#### Phase 3 — Manually Verified (live API, real accounts, real HTTP requests)

All of the following were tested end-to-end against the running backend, not just reviewed in code:

- Exactly one Owner maintained (self-demote and self-remove both correctly rejected: `400 CANNOT_DEMOTE_OWNER` / `400 CANNOT_REMOVE_OWNER`)
- Editor blocked from: changing roles, removing members, sending invitations, renaming workspace (all `403 INSUFFICIENT_ROLE`); confirmed Editor **can** view members (`200`)
- Viewer blocked from the same four actions as Editor; confirmed Viewer **can** view members
- Removed member loses access immediately, even with an existing valid session (`403 NOT_A_MEMBER` on their very next request)
- Cross-workspace isolation: User A cannot access User B's workspace by ID (`403 NOT_A_MEMBER`), and a nonexistent workspace ID returns the identical error (no enumeration signal)
- Invitation expiration enforced (`400 INVITATION_EXPIRED`) — verified by backdating an invitation's `expiresAt` in MongoDB and confirming acceptance is rejected

---

## Architectural Notes & Deviations

Recorded per the project's own "Source of Truth" principle — architectural decisions should be explicit, not silent.

- **Password hashing library changed mid-project.** Originally attempted with `argon2` (native, requires `node-gyp`/Visual Studio Build Tools on Windows — installation failed in this dev environment). Switched to `@node-rs/argon2`, a Rust/NAPI-RS binding with prebuilt cross-platform binaries. Final result still uses Argon2id exactly as originally specified — only the underlying package changed, not the algorithm.

- **Route naming: `/dashboard` and `/workspace/new` instead of `/app/dashboard` and `/app/workspace/new`.** The architecture spec's route tree specifies an `/app/...` prefix for protected routes. This project intentionally keeps the flatter structure instead. Functionally equivalent — both are behind the same route-protection layout and the same backend authorization boundary — this is a naming preference, not a security or architecture difference.

- **Root route (`/`) behavior was unspecified in the original architecture document.** The spec's route tree lists `/` as existing but never defines its behavior, and no development phase explicitly owns it. Implemented as an auth-aware redirect (authenticated → `/dashboard`, unauthenticated → `/login`) rather than a marketing landing page, since Postly has no marketing content at this MVP stage.

- **Password reset and invitation emails are not actually sent.** Real email delivery is out of MVP scope per the architecture spec. Both flows log their link to the backend console (`[DEV ONLY]` prefix) instead, so each flow remains fully testable end-to-end in development. Swapping in a real email provider (e.g. Resend, Postmark) later only requires replacing the `console.log` calls in `AuthService.forgotPassword()` and `InvitationsService.createInvitation()` — token generation, hashing, expiry, and validation are already production-shaped.

- **Workspace context uses client-side active-workspace state (Zustand + localStorage) rather than a workspace-scoped URL structure** (e.g. `/workspaces/:id/dashboard`). The architecture spec permits either approach as long as server-side membership validation is enforced on every request — which it is, via `WorkspaceGuard`, and has been explicitly verified by tampering with `localStorage` directly and confirming the app self-heals rather than leaking unauthorized data.

- **Workspace slug is system-generated and immutable.** Users only provide a workspace name; the backend generates and guarantees a unique slug. This avoids the slug ever being treated as (or confused with) an authorization mechanism, and avoids broken links if a slug were later editable.

- **MongoDB replica set enabled in local development** (single-node `rs0`) specifically to support multi-document transactions, which are required for atomic workspace creation (workspace + Owner membership) and atomic invitation acceptance (membership + invitation-accepted). This is a deliberate infra decision, not default Docker Mongo behavior.

- **Automated test suite deferred for both Phase 2 (authentication) and Phase 3 (workspace/RBAC).** All security-critical behavior — session handling, CSRF, rate limiting, RBAC boundaries, Owner invariants, cross-workspace isolation, invitation expiration — was manually verified against the live API with real accounts and real HTTP requests, and the exact expected status codes/error bodies were confirmed. Automated coverage is intentionally deferred; if this authorization logic is refactored later, this manual verification should be re-run or converted into automated tests at that time.

---

## Project Structure

```
postly/
├── apps/
│   ├── api/                    # NestJS backend
│   │   └── src/
│   │       ├── auth/           # signup, login, logout, /me, sessions, guards, password reset
│   │       ├── users/          # user schema + service
│   │       ├── sessions/       # Redis-backed session storage (hashed tokens)
│   │       ├── workspaces/     # workspace CRUD, WorkspaceGuard, workspace context
│   │       ├── memberships/    # member list, role changes, removal
│   │       ├── invitations/    # invite creation, preview, accept
│   │       ├── redis/          # global Redis client provider
│   │       └── common/         # RolesGuard, @Roles decorator, exception filter, Role enum
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/
│           │   ├── (auth)/     # login, signup, forgot-password, reset-password, invitations/[token]
│           │   └── (dashboard)/# dashboard, team, settings, workspace/new
│           ├── components/
│           │   ├── auth/       # login-form, signup-form
│           │   └── workspace/  # workspace-switcher, invite-member-dialog, role-control, etc.
│           └── lib/
│               ├── api/        # typed API client functions per domain
│               ├── hooks/      # TanStack Query hooks
│               └── stores/     # Zustand (active workspace only — no server data)
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

---

## Next Phase

**Phase 4 — App Shell + Dashboard** (polished sidebar, header, navigation, final workspace switcher placement — Phase 3 intentionally built only a functional, non-polished version of these).
