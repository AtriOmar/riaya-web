# Riaya Project Context (for AI)

This document is a compact project guide for AI assistants working on this repo.

## What This Project Is

- Riaya is an AI-powered healthcare appointment platform.
- The repo currently has **two TypeScript apps**:
  - `web-ts`: Next.js web app (frontend + API routes + DB layer).
  - `socket`: realtime bridge for Twilio phone calls, dashboard websocket streaming, and AI-assisted booking flow.
- High-level flow:
  - Phone call enters `socket` via Twilio media stream.
  - `socket` uses tool/function calling and requests Next API endpoints in `web-ts`.
  - Admin dashboard in `web-ts` listens to realtime call events over websocket.

## Core Tech Stack

### Frontend / Web App (`web-ts`)

- Next.js (App Router), React, TypeScript
- Tailwind CSS v4 + `tw-animate-css` + shadcn styles
- Radix/shadcn UI components
- SWR for data fetching/caching in client components
- Axios for HTTP client in services
- React Hook Form + Zod for form validation
- Better Auth for auth/session
- Drizzle ORM + PostgreSQL
- Biome for lint/format

### Realtime Backend (`socket`)

- Node.js + Express + TypeScript
- `ws` WebSocket servers (Twilio stream + dashboard)
- Twilio media stream handling
- Azure/OpenAI realtime integration
- Axios for calling Next API endpoints
- Pino logging

## Repo Structure

- `web-ts/src/app`: Next app routes and API routes (`/api/...`)
- `web-ts/src/components`: UI and feature components
- `web-ts/src/services`: frontend API service layer
- `web-ts/src/services/types.ts`: app-level TS types used by services/components
- `web-ts/src/db`: Drizzle schema, DB instance, seeds
- `web-ts/src/lib`: shared utilities (`api-utils`, auth helpers, SWR fetcher, etc.)
- `web-ts/src/hooks`: custom React hooks (including realtime dashboard socket)
- `socket/src/server.ts`: HTTP + websocket entrypoint
- `socket/src/twilioSession.ts`: core Twilio <-> AI <-> dashboard session logic
- `socket/src/systemMessages.ts`: assistant behavior + function tool specs
- `socket/src/types.ts`: realtime message and API-related types

## Package management

- Use **pnpm** for this repo (not npm or yarn): installs, adds, and scripts should go through `pnpm`.
- Examples: `pnpm install`, `pnpm add <pkg>`, `pnpm run <script>` from the repo root or from `web-ts/` / `socket/` as needed.

## Working Conventions (Important)

### 1) Services-first API consumption

- For frontend API calls, create/update functions in `web-ts/src/services/*.ts`.
- Re-export via `web-ts/src/services/index.ts` when appropriate.
- Use shared axios instance from `web-ts/src/services/api.ts`.
- Keep route-specific request/response types close to services; shared/domain types live in `web-ts/src/services/types.ts`.

### 2) Types are explicit and centralized

- DB-backed types often derive from Drizzle (`InferSelectModel`) in `web-ts/src/services/types.ts`.
- Add composed UI/API-friendly types there when reused in multiple places.
- Realtime message contracts are defined in `socket/src/types.ts`.

### 3) Validation with Zod

- API routes in `web-ts/src/app/api/**/route.ts` validate query/body using `zod`.
- Forms use `react-hook-form` + `zodResolver`.
- Keep schema near the route/component that owns the validation.

### 4) SWR usage pattern

- Use `useSWR(key, serviceFn)` in client components.
- Keep fetch logic in services, not inline in components.
- Shared fetcher helper exists in `web-ts/src/lib/swr.ts`.

### 5) Tailwind + shadcn UI style

- Styling is utility-class driven with Tailwind.
- Prefer existing UI primitives from `web-ts/src/components/ui/*`.
- Theme tokens and custom utilities live in `web-ts/src/app/globals.css`.

### 6) API route style in Next

- Route handlers usually:
  - parse input with Zod
  - enforce auth/role with helpers from `web-ts/src/lib/api-utils.ts`
  - run Drizzle query/mutation
  - return typed JSON helper responses (`json`, `apiError`, `validationError`)

### 7) Realtime architecture rules

- `socket` manages two websocket channels:
  - Twilio media stream (`/media-stream`)
  - Dashboard monitoring (`/dashboard`)
- `twilioSession.ts` sends dashboard events (`call_start`, transcripts, function calls, booking status).
- `socket` depends on Next API endpoints (for doctor slot finding and external appointment creation).

## Database Notes

- Drizzle schema lives in `web-ts/src/db/schema.ts`.
- Main domain tables include:
  - `speciality`, `cities`
  - `doctor_profile`, `doctor_application`
  - `patient`, `patient_medical_file`
  - `appointment`, `consultation`, `doctor_unavailability`
- Better Auth tables are integrated via `auth-schema` and re-exported from schema entry.

## Environment Notes

- Frontend/web uses env vars like:
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_REALTIME_URL`
  - `DATABASE_URL`
  - R2/CDN vars (`R2_*`, `CDN_URL`)
- Realtime/socket uses vars like:
  - `PORT`, `LOG_LEVEL`, `PUBLIC_SOCKET_HOST`
  - AI/audio tuning vars (`VAD_THRESHOLD`, `SILENCE_DURATION_MS`, `MAX_OUTPUT_TOKENS`)
  - Next API base URL for cross-service calls

## File uploads (Cloudflare R2)

- **We do not send file bytes through our own API for storage.** The client requests a **presigned upload URL** from `POST /api/upload/signed-url` (session required), which returns `signedUrl` and the final public **`cdnUrl`** (built from `CDN_URL` + object key; see `web-ts/src/app/api/upload/signed-url/route.ts`).
- **Client helpers** in `web-ts/src/lib/upload.ts`:
  - `uploadToR2(file, folder)` for `File` inputs.
  - `uploadBlobToR2(blob, filename, folder)` wraps blobs as `File` (e.g. canvas output from `react-easy-crop`).
  - Both call `getSignedUploadUrl` in `web-ts/src/services/upload.ts`, **`PUT`** the bytes to `signedUrl`, then return **`cdnUrl`**.
- **Folders** (typed as `UploadFolder`): `profile-pictures`, `doctor-applications`, `medical-files`.
- **Persistence:** after upload, features store only the **public CDN URL string** on the relevant record (e.g. profile picture via `updateProfilePicture(cdnUrl)` after `uploadBlobToR2` in `web-ts/src/components/dashboard/profile/image-cropper.tsx`; doctor application docs use `uploadToR2` similarly).

## Reference Files for Coding Style

Use these as examples before changing related code.

### Frontend references

- `web-ts/src/components/auth/register-form.tsx` (React Hook Form + Zod + Tailwind UI)
- `web-ts/src/components/admin/stats.tsx` (SWR + service usage in client component)
- `web-ts/src/components/admin/applications-table.tsx` (table/data UI conventions)
- `web-ts/src/components/admin/calls/live-calls.tsx` (realtime dashboard UI pattern)
- `web-ts/src/hooks/use-realtime-socket.ts` (custom hook with websocket/reconnect logic)
- `web-ts/src/services/appointments.ts` (service file style and typed axios calls)
- `web-ts/src/services/doctor-applications.ts` (service naming and API mapping)
- `web-ts/src/services/types.ts` (shared domain/composite typing)
- `web-ts/src/app/api/appointments/route.ts` (API route + Zod + auth helper + Drizzle)
- `web-ts/src/lib/api-utils.ts` (auth/role helpers for API routes)
- `web-ts/src/lib/upload.ts` + `web-ts/src/services/upload.ts` (R2 presigned upload + `cdnUrl` return)
- `web-ts/src/components/dashboard/profile/image-cropper.tsx` (crop → blob → `uploadBlobToR2` → save URL)

### Backend/realtime references

- `socket/src/server.ts` (Express + websocket server composition)
- `socket/src/twilioSession.ts` (core session orchestration and function handling)
- `socket/src/systemMessages.ts` (AI prompt/tool definitions)
- `socket/src/types.ts` (message contracts and API data types)
- `socket/src/constants.ts` and `socket/src/constants/*` (shared static domain data)

## Practical AI Instructions

- Use **pnpm** for package and script commands (see [Package management](#package-management)).
- For R2 uploads, use `uploadToR2` / `uploadBlobToR2` and persist the returned **`cdnUrl`** (see [File uploads (Cloudflare R2)](#file-uploads-cloudflare-r2)).
- When adding or changing frontend data access:
  - update/create service in `web-ts/src/services`
  - update types in `web-ts/src/services/types.ts` if shared
  - consume via SWR/hooks/components
- When adding API behavior:
  - implement in `web-ts/src/app/api/.../route.ts`
  - validate with Zod
  - enforce session/role with `api-utils`
  - keep error response shape consistent
- When adding realtime events:
  - update message types in `socket/src/types.ts`
  - broadcast from `twilioSession.ts`
  - handle in `web-ts/src/hooks/use-realtime-socket.ts`
- Prefer consistency with existing files over introducing new patterns.

