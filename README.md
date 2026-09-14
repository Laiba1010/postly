Postly

Multi-tenant social media scheduling and publishing SaaS for small marketing and content teams.

Postly is a portfolio case study focused on a real asynchronous publishing workflow rather than a simple CRUD dashboard. The core technical story is:

Create → Preview → Schedule → Queue → Publish → Monitor → Success/Failure → Retry

Each destination platform is represented by an independent PostTarget, allowing one platform to succeed while another fails or retries.

Documentation scope: This README documents the implementation through Phase 10 — Retry, Attempts & Failure Management. Later roadmap phases are intentionally not described as implemented here, even where the repository contains placeholders or UI prepared for future work.

Current Status

Implemented through Phase 10

Phase

Area

Status

0

Product & Architecture Foundation

✅ Defined / approved

1

Project Foundation

✅ Implemented

2

Authentication

✅ Implemented

3

Workspace & Team / RBAC

✅ Implemented

4

Application Shell & Dashboard

✅ Implemented

5

Social Account Connection

✅ Implemented with mock OAuth

6

Post Composer & Media

✅ Implemented

7

Scheduling Engine

✅ Implemented

8

BullMQ Publishing Infrastructure

✅ Implemented

9

Mock Social Platform

✅ Implemented

10

Retry, Attempts & Failure Management

✅ Implemented

The next roadmap phase is Phase 11 — Job Status Updates. It is intentionally outside the scope of this README.

1. Product

What Postly Does

Postly helps small marketing and content teams create, organize, schedule, and reliably publish social media content from a shared workspace.

The product combines:

Multi-tenant workspaces

Team collaboration

Role-based access control

Social account connections

Content creation

Media management

Scheduling

Asynchronous publishing

Per-platform publishing state

Retry and failure handling

Observable publishing attempts

Target Users

Primary users include:

Social media managers

Content creators

Marketing managers

Small agency teams

Typical team size: 2–10 people.

Core Differentiator

Postly is intentionally more than a CRUD application.

Its main technical differentiator is reliable asynchronous multi-platform publishing with observable status, retries, idempotency, and failure recovery.

Publishing is therefore modeled as a domain workflow instead of a single published: true/false field.

2. Architecture Principles

The implementation follows these core invariants:

Every workspace resource is scoped to a workspace.

Protected workspace actions are authorized server-side.

Multi-platform posts use independent PostTarget records.

Each PostTarget has its own publishing lifecycle.

PublishingAttempt belongs to a PostTarget.

BullMQ job identity is deterministic.

Scheduled timestamps are normalized to UTC.

Social credentials are encrypted at rest.

The frontend never talks directly to MongoDB or Redis.

Publishing is asynchronous.

Publishing failures are observable.

Retry behavior is idempotent.

A post can represent partial publication.

High-risk publishing behavior receives targeted tests.

Structured logs must not expose credentials or other secrets.

The project is developed incrementally. A later phase should not silently change an earlier architectural decision.

3. Technology Stack

Frontend

Next.js App Router

React

TypeScript

Tailwind CSS

shadcn/ui / Base UI primitives

TanStack Query for server state

Zustand for client UI state

React Hook Form

Zod

Backend

Node.js

NestJS

TypeScript

MongoDB

Mongoose

Redis

ioredis

BullMQ

@node-rs/argon2 for Argon2id password hashing

Joi for environment configuration validation

class-validator / class-transformer

Sharp for image processing

Infrastructure

pnpm workspaces

Docker Compose

MongoDB single-node replica set for local development/transactions

Redis

4. Repository Structure

postly/
├── apps/
│ ├── api/ # NestJS backend
│ │ └── src/
│ │ ├── auth/ # Signup, login, logout, password reset
│ │ ├── users/ # User domain
│ │ ├── sessions/ # Redis-backed sessions
│ │ ├── workspaces/ # Workspace lifecycle + isolation
│ │ ├── memberships/ # Workspace members + RBAC
│ │ ├── invitations/ # Invitation lifecycle
│ │ ├── social-connections/ # Mock OAuth + connections
│ │ ├── media/ # Upload, validation, storage
│ │ ├── posts/ # Posts, targets, scheduling, aggregation
│ │ ├── queue/ # BullMQ queue, worker, retries, reconciliation
│ │ ├── mock-platform/ # Mock external publishing API
│ │ ├── redis/ # Redis infrastructure
│ │ ├── health/ # Health checks
│ │ └── common/ # Guards, decorators, errors, shared backend logic
│ │
│ └── web/ # Next.js frontend
│ └── src/
│ ├── app/ # Routes and layouts
│ ├── components/ # UI and domain components
│ ├── hooks/ # Client hooks
│ └── lib/ # API clients, hooks, validation, state
│
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── README.md

5. Phase 0 — Product & Architecture Foundation

Status: ✅ Approved

Phase 0 established the source of truth for the product and implementation.

Product Model

Core product loop:

CREATE
↓
PREVIEW
↓
SCHEDULE
↓
QUEUE
↓
PUBLISH
↓
MONITOR
↓
SUCCESS / FAILURE
↓
RETRY
↓
PUBLISHED

Core Domain

The architecture defines these primary entities:

User

Session

Workspace

Membership

Invitation

SocialConnection

Post

PostTarget

Media

PublishingAttempt

Workspace Model

User
↓
Membership
↓
Workspace
↓
Workspace resources

Roles:

OWNER

EDITOR

VIEWER

Backend authorization is the security boundary. Frontend permission checks are only a UX layer.

Publishing Model

Post
├── Instagram PostTarget
├── Facebook PostTarget
├── LinkedIn PostTarget
└── X PostTarget

Each target can independently publish, fail, or retry.

Architectural Decisions

One owner per workspace.

Ownership transfer is not supported in the MVP.

Workspace owner cannot remove or demote themselves.

Invitations expire after 7 days.

Pending invitations can be revoked.

Published posts are not edited in place as a publishing operation; duplication is used when appropriate.

Cancellation does not attempt to interrupt an already active PUBLISHING operation.

Media has explicit cleanup rules and a storage abstraction.

PostTargetStatus uses PUBLISHED rather than SUCCESS.

Post status is derived from target state.

6. Phase 1 — Project Foundation

Status: ✅ Implemented

Monorepo

The repository uses pnpm workspaces:

apps/api
apps/web

Backend Foundation

NestJS module architecture

Environment configuration

Joi configuration validation

Global API prefix: /api

Global request validation

Consistent exception response foundation

CORS configuration

Structured application logging foundation

Mongoose connection

Redis connection

Health checks

Database

MongoDB is accessed through Mongoose.

A local MongoDB replica set is used because multi-document transactions are required by important workflows such as workspace creation and invitation acceptance.

Redis

Redis is used for:

Session storage

BullMQ infrastructure

Mock-platform idempotency state

Rate limiting where configured

Health Check

GET /api/health

The health endpoint checks the application dependencies, including MongoDB and Redis.

Media Foundation

The media layer uses a storage abstraction so local development storage does not permanently lock the application to a filesystem implementation.

7. Phase 2 — Authentication

Status: ✅ Implemented

Authentication Flow

Implemented endpoints include:

Signup

Login

Logout

GET /auth/me

Forgot password

Reset password

Password Security

Passwords use Argon2id through @node-rs/argon2.

Raw passwords are never persisted.

Sessions

Sessions are stored in Redis.

The raw session token is held by the browser in a secure cookie. Redis stores a SHA-256 hash of the token rather than the raw token.

Session behavior includes:

HttpOnly cookie

Secure-cookie configuration

SameSite configuration

Sliding session expiry

Session invalidation on logout

CSRF Protection

Unsafe HTTP methods are protected using CSRF/origin validation appropriate to the cookie-based session model.

Rate Limiting

The API has global rate limiting with stricter limits on sensitive authentication operations such as:

Signup

Login

Forgot password

Password Reset

Reset tokens are:

Randomly generated

Stored only as hashes

Expiring

Single-use

Development builds can expose reset links through the backend development output instead of sending real email. Real email delivery is outside the current Phase 0–10 scope.

8. Phase 3 — Workspace & Team Management

Status: ✅ Implemented

Workspace Operations

Implemented workspace functionality includes:

Create workspace

List user's workspaces

Retrieve workspace

Rename workspace

Delete workspace

Workspace creation is transactional so the workspace and its initial owner membership are created together.

Workspace Isolation

Every workspace-scoped API operation requires membership validation.

A workspace ID in a URL is never treated as proof of authorization.

Request
↓
AuthGuard
↓
WorkspaceGuard
↓
RolesGuard (when required)
↓
Service-level workspace-scoped query

Roles

Owner

Can:

Manage workspace settings

Manage members

Manage roles

Invite members

Remove members

Manage social connections

Manage posts

Editor

Can:

Create/edit posts

Manage drafts

Schedule/reschedule/cancel posts

Manage social connections according to the architecture

Retry failed publishing targets

Cannot manage workspace membership or owner-level settings.

Viewer

Read-only access where permitted.

Cannot perform workspace mutations, create/edit posts, or manually retry publishing targets.

Owner Invariant

A workspace must always have exactly one owner.

Owner self-removal and self-demotion are rejected.

Invitations

Invitation lifecycle:

PENDING
↓
ACCEPTED

or:

PENDING
↓
EXPIRED / REVOKED

Invitation tokens are hashed before persistence.

Acceptance verifies the authenticated user's email against the invitation email.

Invitation acceptance is transactional so membership creation and invitation consumption stay consistent.

9. Phase 4 — Application Shell & Dashboard

Status: ✅ Implemented

The application shell provides the usable SaaS workspace around the real backend context.

Implemented UI includes:

Sidebar

Header

Workspace switcher

Workspace navigation

Dashboard

KPI/status areas

Upcoming posts area

Failed activity area

Connected-account information

Quick-create entry points

Loading/empty/error states where applicable

Permission-aware UI behavior

The active workspace is persisted client-side for UX convenience, but authorization is always rechecked by the backend.

The workspace selector also self-heals when its stored workspace ID becomes stale or inaccessible.

10. Phase 5 — Social Account Connection

Status: ✅ Implemented with mock OAuth

Supported Mock Platforms

Instagram

Facebook

LinkedIn

X

Flow

Connect
↓
Mock OAuth
↓
Authorize
↓
Callback
↓
Validate
↓
SocialConnection

Connection Management

Implemented operations include:

Start mock OAuth

Handle callback

Create connection

List workspace connections

Disconnect connection

Track connection state

Multiple accounts per provider are supported.

The uniqueness boundary is based on the workspace, provider, and external account ID.

Credential Security

Access and refresh credentials are encrypted at rest using an application-level encryption key supplied through environment configuration.

Credentials are not returned unnecessarily and are not included in structured logs.

Real platform OAuth and real publishing APIs are intentionally outside Phase 0–10.

11. Phase 6 — Post Composer & Media

Status: ✅ Implemented

Posts

Implemented draft operations include:

Create draft

Read draft

Update draft

Delete draft

Duplicate draft

List drafts

Only Owner/Editor roles can mutate posts. Viewer is read-only.

Media

Implemented media functionality includes:

Upload

Metadata persistence

MIME validation

Size validation

Image processing/validation

Preview/download access

Media removal

Post association

Storage abstraction

Cleanup handling

Platform Rules

Platform-aware rules are centralized rather than duplicated across UI components.

Supported platforms at this stage:

Instagram

Facebook

LinkedIn

X

Media Safety

The upload layer applies size and type restrictions and avoids treating a client-provided MIME type as the only source of truth.

Media access is workspace-scoped.

12. Phase 7 — Scheduling Engine

Status: ✅ Implemented

Scheduling accepts:

Local date

Local time

Timezone

The backend converts the requested local time into a canonical UTC timestamp.

Local date +
Local time +
Timezone
↓
UTC
↓
Post.scheduledAt
↓
PostTarget.scheduledAt

PostTargets

A scheduled post creates one independent target per destination platform.

Example:

Post
├── Instagram Target
├── Facebook Target
└── LinkedIn Target

Scheduling Operations

Schedule draft

Reschedule scheduled post

Cancel schedule

Scheduling Rules

The backend handles:

Past timestamps

Invalid timezones

Timezone conversion

DST-sensitive timestamps

Duplicate scheduling requests

State validation

Cancellation

Cancellation updates pending targets and coordinates with the queue.

An already active PUBLISHING target is not forcefully interrupted by the MVP cancellation path. The worker rechecks target state to avoid publishing stale/cancelled work.

13. Phase 8 — BullMQ Publishing Infrastructure

Status: ✅ Implemented

Postly uses BullMQ with Redis for asynchronous publishing.

Job Identity

There is exactly one logical publishing job per PostTarget.

The deterministic BullMQ job ID is:

PostTarget.id

This allows scheduling and rescheduling to coordinate with the same publishing identity.

Queue Flow

Scheduled PostTarget
↓
BullMQ / Redis
↓
Worker
↓
Load PostTarget
↓
Verify current state
↓
PUBLISHING
↓
Create / resume PublishingAttempt
↓
Execute mock platform publish

Worker Responsibilities

The worker handles:

Stale-job checks

Target state transitions

Publishing attempt creation

External/mock publishing

Success handling

Failure handling

Retry scheduling

Idempotent replay

Parent post status aggregation

Graceful shutdown

Queue Retention

Completed and failed BullMQ jobs are retained in bounded quantities rather than indefinitely, preventing unbounded Redis job accumulation.

Reconciliation

A reconciliation service repairs queue/database drift by finding publishable targets that do not have the expected queue work.

The database remains the durable source of publishing state; Redis is the asynchronous execution mechanism.

14. Phase 9 — Mock Social Platform

Status: ✅ Implemented

The mock platform simulates the behavior of an external social publishing API instead of making the worker depend on a hard-coded success response.

Simulated Outcomes

The mock platform can produce:

Success

RATE_LIMITED

NETWORK_ERROR

PLATFORM_ERROR

INVALID_MEDIA

AUTH_ERROR

The default scenario distribution intentionally favors successful publishing while still producing realistic failures for demonstrations and testing.

Simulated Latency

The mock platform introduces non-zero simulated latency so the worker behaves more like it is communicating with a real external service.

Idempotency

Publishing requests use a deterministic idempotency key derived from the publishing target and attempt identity.

Resolved mock-platform outcomes are cached for a bounded period so replaying the same operation does not create a second external publication.

15. Phase 10 — Retry, Attempts & Failure Management

Status: ✅ Implemented

Phase 10 is the main reliability layer of the MVP publishing architecture.

PublishingAttempt

Every actual publish attempt gets its own durable record.

Important fields include:

postTargetId

attemptNumber

status

errorCode

errorMessage

startedAt

completedAt

createdAt

A unique (postTargetId, attemptNumber) constraint prevents duplicate attempt records.

Failure Classification

Retryable

RATE_LIMITED

NETWORK_ERROR

PLATFORM_ERROR

Permanent

INVALID_MEDIA

AUTH_ERROR

Automatic Retry

Automatic retry uses exponential backoff.

Current configuration:

MAX_PUBLISH_ATTEMPTS = 3
BASE_DELAY = 1 second
MULTIPLIER = 2

The resulting automatic retry delays begin at:

1s → 2s → 4s

retryCount represents the lifetime number of automatic retries already scheduled. Manual retry does not reset that value.

Target Lifecycle

SCHEDULED
↓
PUBLISHING
├──→ PUBLISHED
│
├──→ RETRYING
│ ↓
│ PUBLISHING
│
└──→ FAILED

Post Aggregation

The parent post status is derived from its target states.

Important cases:

All targets SCHEDULED
→ SCHEDULED

Any target PUBLISHING / RETRYING
→ PUBLISHING

All targets PUBLISHED
→ PUBLISHED

All targets FAILED
→ FAILED

Published + failed targets
→ PARTIALLY_PUBLISHED

CANCELLED remains authoritative when the post itself has been cancelled.

Manual Retry

Manual retry operates at the target level.

Only failed targets are retried. Successfully published targets are never republished just because another target failed.

The failed target transition is guarded atomically to prevent two concurrent manual retry requests from both claiming the same target.

Idempotency / Failure Recovery

Phase 10 explicitly handles:

Worker restart during an attempt

Duplicate job delivery

External success followed by worker failure

Replayed publish requests

Automatic retry exhaustion

Manual retry

Manual retry races

Partial publication

Duplicate terminal resolution

The worker resumes an existing open attempt where appropriate instead of blindly creating another external operation.

16. End-to-End Publishing Flow Through Phase 10

User
↓
Composer
↓
Draft
↓
Select platforms
↓
Create PostTargets
↓
Schedule
↓
UTC normalization
↓
BullMQ delayed job(s)
↓
Worker
↓
PUBLISHING
↓
PublishingAttempt
↓
Mock Social Platform
├───────────────┐
↓ ↓
SUCCESS FAILURE
↓ ↓
PUBLISHED classify error
↓
┌────────┴────────┐
↓ ↓
Retryable Permanent
↓ ↓
RETRYING FAILED
↓
Backoff delay
↓
PUBLISHING
↓
Success / Failed
↓
Aggregate Post Status

For a multi-platform post:

Post
├── Instagram → PUBLISHED
├── Facebook → RETRYING
└── LinkedIn → PUBLISHED

The parent remains in an active publishing state while the failed target can recover independently.

If Facebook eventually succeeds:

Post
├── Instagram → PUBLISHED
├── Facebook → PUBLISHED
└── LinkedIn → PUBLISHED

The parent becomes:

PUBLISHED

17. Security Model Through Phase 10

Security is implemented as each feature is introduced rather than postponed to a later hardening phase.

Authentication

Argon2id password hashing

Hashed session tokens

HttpOnly cookies

Secure cookie configuration

SameSite configuration

CSRF protection

Origin validation

Authentication guards

Safe authentication errors

Rate limiting

Multi-Tenancy

Workspace membership required

Workspace-scoped service queries

Server-side RBAC

Cross-workspace access rejected

Resource IDs are never treated as sufficient authorization

Credentials

Social access/refresh credentials encrypted at rest

Encryption key supplied through environment configuration

Credentials are not intentionally returned in normal API responses

Credentials are not logged

Media

Upload size limits

MIME/type validation

Workspace-scoped access

Cleanup handling

Storage abstraction

Queue Security

Logs may contain operational identifiers such as:

workspace ID

post ID

target ID

job ID

attempt number

platform

status

error code

timestamp

They must not contain access tokens, refresh tokens, session tokens, reset tokens, or other credentials.

18. Data Integrity & Reliability

Important workflows use MongoDB transactions where multiple related records must change together.

Examples include:

Workspace + owner membership creation

Invitation acceptance

Target state + attempt state + parent status transitions

Manual retry state transition

Other Phase 0–10 multi-document operations where atomicity is required

Queue/database coordination intentionally does not pretend MongoDB and Redis share a distributed transaction.

The design uses durable database state plus deterministic queue identity and reconciliation to recover from queue/database drift.

19. Testing Through Phase 10

The project uses Jest for backend tests.

Targeted tests cover important low-level behavior such as:

Password hashing behavior

Retry policy

Authentication/security behavior where tests are present

High-risk publishing state logic where introduced

The project also relies on integration/manual verification for critical end-to-end workflows during incremental development.

The broader unit/integration/E2E testing expansion remains a later roadmap concern; this README does not claim Phase 21-level test coverage.

20. Environment Configuration

Copy the API environment example into the local environment and provide the required secrets.

Typical backend configuration:

NODE_ENV=development
PORT=4000
DATABASE_URL=mongodb://localhost:27017/postly?replicaSet=rs0
REDIS_URL=redis://localhost:6379
SESSION_SECRET=<strong-random-secret>
TOKEN_ENCRYPTION_KEY=<strong-random-secret>
CORS_ORIGIN=http://localhost:3000

Frontend:

NEXT_PUBLIC_API_URL=http://localhost:4000

Never commit real environment files or secrets.

21. Local Development

Prerequisites

Node.js

pnpm

Docker Desktop

Start Infrastructure

docker compose up -d

The local MongoDB instance is configured as a replica set for transaction support.

If the replica set has not yet been initialized in a fresh environment, initialize it according to the Docker MongoDB setup used by this repository.

Install Dependencies

pnpm install

Start Applications

pnpm dev

Or individually:

pnpm dev:api
pnpm dev:web

Typical local addresses:

Frontend: http://localhost:3000

API health: http://localhost:4000/api/health

Quality Commands

pnpm lint
pnpm format

Backend commands:

pnpm --filter api build
pnpm --filter api test
pnpm --filter api test:cov

22. Phase Completion Philosophy

A phase is not considered complete merely because its UI renders.

Each phase follows the project's incremental execution rule:

Product Goal
↓
User Stories
↓
UX / UI Decisions
↓
Architecture
↓
Data Model
↓
API Contract
↓
Frontend
↓
Backend
↓
Integration
↓
Edge Cases
↓
Targeted Tests
↓
Review / Refactor
↓
Phase Approval
↓
Next Phase

The implementation should challenge assumptions, preserve approved architectural decisions, and avoid silently introducing infrastructure for later phases.

23. Phase 0–10 Boundary

The system demonstrated by the end of Phase 10 is:

Authentication
↓
Workspace + Team + RBAC
↓
Social Connections
↓
Composer + Media
↓
Draft
↓
Scheduling + UTC
↓
PostTargets
↓
BullMQ
↓
Worker
↓
Mock Platform
↓
PublishingAttempt
↓
Success / Failure
↓
Retry + Backoff
↓
Aggregate Status

This is the intended Phase 0–10 foundation for the later MVP work. Later capabilities such as richer status monitoring, complete posts management, calendar, drag-and-drop scheduling, DLQ, webhooks, carousels, analytics, AI assistance, production hardening, broader testing, and deployment/observability are intentionally outside this README's implementation boundary.

Source of Truth

Postly's product and architecture specification is the source of truth for architectural decisions. The incremental roadmap defines the implementation sequence.

If implementation and architecture conflict:

Stop and identify the conflict.

Determine whether the implementation is wrong, the specification needs amendment, or the feature should be deferred.

Do not silently introduce an architectural change.
