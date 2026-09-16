# Secure RFQ upload implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Implement private, quarantined and auditable RFQ uploads without breaking the existing JSON lead flow.

**Architecture:** Pages Functions accept JSON or streamed multipart data, verify Turnstile and idempotency before writes, validate files, then coordinate D1 and private R2. Parameterized Pages Function files provide Access-protected employee metadata, download and review actions. A separate Cron Worker performs bounded cleanup.

**Tech Stack:** Eleventy 3, browser JavaScript, Cloudflare Pages Functions, D1, private R2, Turnstile, Cloudflare Access, Web Crypto and Node test runner.

**Spec:** docs/UPLOAD_ARCHITEKTUR_PLAN.md

## Global constraints

- Maximum 5 files, 8 MiB per file and 16 MiB total multipart body.
- Extensions: .pdf, .dxf (ASCII only), .step, .stp, .jpg, .jpeg and .png.
- Every file starts with security_status quarantine; downloading never approves it.
- storage_status is exactly pending, stored, delete_pending, deleted or failed.
- security_status is exactly quarantine, approved or rejected.
- Business states stay on leads or order data.
- Turnstile is mandatory for JSON and multipart production requests before D1/R2.
- A server-validated UUID request ID is unique in D1; replay creates no second lead.
- R2 is private and emits no public object URL.
- Preview and production bindings, secrets, migrations and deployments are separate and require explicit approval.
- Existing JSON names, translations, consent and lead validation remain compatible.

## Verified baseline

functions/api/leads.js is JSON-only and uses env.DB; the live form is modules/kontakt.html plus js/app.js; schema.sql contains only leads; eleventy.config.mjs copies listed public roots; package.json exposes npm test, npm run build and npm run dev:preview; no R2 binding, multipart route, Access route, cleanup Worker or _routes.json exists. modules/07_contact.html is unused legacy markup.

## Package A — data model, parser and tests

### Task A1 — fixture contract

**Files:** Create tests/upload-fixtures.mjs.
**Red test / run / expected fail:** Import functions/upload/validation.mjs; run node --test tests/upload-fixtures.mjs; expect module-not-found.
**Implement / pass:** Export validFiles, invalidFiles, limitCases, multipartBodies and requestIds; fixture assertions load.
**Commit boundary:** Fixture file only.

### Task A2 — request and lead validation

**Files:** Create functions/upload/validation.mjs; modify tests/upload-fixtures.mjs.
**Red test / run / expected fail:** Malformed UUID and lead-field cases; same command; missing parseRequestId and validator.
**Implement / pass:** parseRequestId(value): string and validateLeadFields(input): {ok, errors}; all assertions pass.
**Commit boundary:** Validator and fixture test.

### Task A3 — file signatures

**Files:** Modify validation module and fixture test.
**Red test / run / expected fail:** PDF/JPEG/PNG signatures, STEP markers, ASCII-DXF, binary-DXF and executable rejection; run `node --test tests/upload-fixtures.mjs`; signature assertions fail.
**Implement / pass:** validateUploadFile(file): Promise<{ok, extension, detectedType, sha256, reason?}> using Web Crypto and structure checks; deterministic hashes pass.
**Commit boundary:** Validator/test only.

### Task A4 — streamed multipart parser

**Files:** Modify validation module; create tests/multipart-parser.test.mjs.
**Red test / run / expected fail:** Boundaries, UTF-8 bytes, 8/16 MiB limits, sixth file and truncation; node --test tests/multipart-parser.test.mjs; parser missing.
**Implement / pass:** Incremental ReadableStreamDefaultReader state machine, count every byte, do not trust Content-Length/extension/browser MIME, discard partial buffers on abort; no new dependency. Tests pass without unbounded buffering.
**Commit boundary:** Parser/test only.

### Task A5 — upload migration

**Files:** Create migrations/0002_lead_uploads.sql; modify schema.sql; create tests/migration-schema.test.mjs.
**Red test / run / expected fail:** Exact columns/checks; node --test tests/migration-schema.test.mjs; migration absent.
**Implement / pass:** lead_uploads has id TEXT PRIMARY KEY, server UUID, lead_id, sha256, original_name, extension, detected_type, r2_key UNIQUE, byte_size, storage_status, security_status, created_at, stored_at, reviewed_at, reviewed_by, rejection_reason, deleted_at and error_code, with a lead foreign key. No business state is added.
**Commit boundary:** Migration/schema/test only; migration is not executed.

### Task A6 — idempotency migration

**Files:** Create migrations/0003_lead_requests.sql; modify schema; extend migration test.
**Red test / run / expected fail:** Unique request ID/state checks; migration command; table absent.
**Implement / pass:** lead_requests stores request_id TEXT PRIMARY KEY, lead_id, state processing/succeeded/failed, response_code, response_body, created_at and completed_at; duplicate IDs are rejected.
**Commit boundary:** Migration/schema/test only.

### Task A7 — audit migration

**Files:** Create migrations/0004_upload_audit_log.sql; modify schema; extend migration test.
**Red test / run / expected fail:** Required actions, nullable columns, nullable-safe foreign keys and redacted detail codes; run `node --test tests/migration-schema.test.mjs`; table/check assertions fail.
**Implement / pass:** upload_audit_log stores id, nullable upload_id, nullable lead_id, actor_type, nullable actor_id, occurred_at, action, result and detail_code. upload_id is nullable for validation failures and R2 orphans; lead_id is nullable when no lead exists; actor_id is nullable for unknown or unauthenticated access. detail_code is a fixed non-sensitive code only and never contains names, paths, tokens, filenames, messages or file data. Foreign keys are nullable-safe: upload_id references lead_uploads(id) with ON DELETE SET NULL and lead_id references leads(id) with ON DELETE SET NULL. Actions are upload_stored, validation_failed, file_approved, file_rejected, download_allowed, download_denied, deletion_requested, file_deleted and cleanup_failed. Tests pass.
**Commit boundary:** Migration/schema/test only.

### Task A8 — quarantine transitions

**Files:** Create functions/upload/state.mjs; create tests/upload-state.test.mjs.
**Red test / run / expected fail:** Download side effect, employee approval/rejection and reverse transition; node --test tests/upload-state.test.mjs; module missing.
**Implement / pass:** transitionUpload(current, action, actor) permits only quarantine to approved/rejected for authorized employees; download remains quarantine and maps to audit.
**Commit boundary:** State module/test.

### Task A9 — schema indexes and retention queries

**Files:** Modify migrations/0002_lead_uploads.sql, 0003_lead_requests.sql and 0004_upload_audit_log.sql; extend tests/migration-schema.test.mjs.
**Red test / run / expected fail:** Required indexes and bounded cleanup queries; node --test tests/migration-schema.test.mjs; index assertions fail.
**Implement / pass:** Add indexes for lead_id, storage_status/created_at, security_status and completed request age; migration/schema tests pass.
**Commit boundary:** Migration/schema/test only.

**Package A acceptance:** A1–A9 pass; migrations are additive and unexecuted; no Cloudflare values are required.

## Package B — upload API and private R2

### Task B1 — Turnstile seam

**Files:** Modify functions/api/leads.js; create tests/leads-upload-api.test.mjs.
**Red test / run / expected fail:** Token verification precedes any write; node --test tests/leads-upload-api.test.mjs; verifier missing.
**Implement / pass:** verifyTurnstile(token, remoteIp, env): Promise<boolean> via Siteverify, production fail-closed and explicit local test mode; no storage before verification.
**Commit boundary:** API/test.

### Task B2 — idempotency reservation

**Files:** Modify API; extend API test.
**Red test / run / expected fail:** New, concurrent, succeeded and failed IDs; run `node --test tests/leads-upload-api.test.mjs`; duplicate lead.
**Implement / pass:** reserveRequest(db, requestId, now): Promise<{state, leadId?, response?}> atomically inserts processing, persists successful response, returns 409 for active duplicate and requires a new ID after failure.
**Commit boundary:** API/test.

### Task B3 — JSON compatibility

**Files:** Modify API; extend tests/leads-api.test.mjs.
**Red test / run / expected fail:** Existing valid JSON, validation, host and methods; node --test tests/leads-api.test.mjs; integration failures.
**Implement / pass:** Retain fields, host rules, GET 405 and OPTIONS 204 while requiring token; existing tests pass.
**Commit boundary:** API/test.

### Task B4 — R2 key/fake

**Files:** Create tests/r2-fake.mjs; modify API test.
**Red test / run / expected fail:** Key excludes original name and collisions fail; run `node --test tests/leads-upload-api.test.mjs`; fake/key helper missing.
**Implement / pass:** createR2Key(leadId, uploadId, extension): string returns leads/{leadId}/{uuid}.{extension}; fake put/get/delete/list proves private unique keys.
**Commit boundary:** Fake/test.

### Task B5 — multipart transaction

**Files:** Modify API; extend API test.
**Red test / run / expected fail:** Valid multipart metadata/object; run `node --test tests/leads-upload-api.test.mjs`; multipart unsupported.
**Implement / pass:** storeLeadAndUploads({db, r2, lead, files, requestId, now}) inserts lead/pending rows, puts to RFQ_UPLOADS, marks stored while retaining quarantine; metadata/hash match.
**Commit boundary:** API/test.

### Task B6 — partial failures

**Files:** Modify API; extend API test.
**Red test / run / expected fail:** D1-after-R2 and R2-after-D1 failures; run `node --test tests/leads-upload-api.test.mjs`; orphan/false success.
**Implement / pass:** Delete objects on D1 failure; mark failed, audit and cleanup on R2 failure; neutral 500.
**Commit boundary:** API/test.

### Task B7 — limits/methods

**Files:** Modify API; extend tests/leads-api.test.mjs.
**Red test / run / expected fail:** Limits, invalid Content-Length, streamed overflow, blocked pages host, GET/OPTIONS; node --test tests/leads-api.test.mjs; new branches fail.
**Implement / pass:** Checks precede body/D1/R2; JSON remains 16 KiB; 413/403/405/204 and zero writes pass.
**Commit boundary:** API/test.

### Task B8 — Package B acceptance

**Files:** API and API tests.
**Red test / run / expected fail:** Combined JSON/multipart matrix; both API test files; uncovered branch.
**Implement / pass:** Minimal owning-package fixes; all API tests pass.
**Commit boundary:** Package B files only.

### Task B9 — abuse and rate-limit contract

**Files:** Modify functions/api/leads.js; create tests/upload-abuse.test.mjs.
**Red test / run / expected fail:** Repeated requests receive 429 before parsing or writes; node --test tests/upload-abuse.test.mjs; limiter hook absent.
**Implement / pass:** Define local testable interface checkUploadRateLimit({request, env}): Promise<{allowed:boolean, retryAfter?:number}> with a deterministic in-memory fake used only by tests. Production may call a configured Workers Rate Limiting binding or a separately confirmed Cloudflare rate-limit rule, but the choice and name must be approved before Package B Preview. Without confirmed production configuration, deployment is blocked; there is no silent bypass. Return neutral HTTP 429 before body parsing and before D1/R2 access; tests prove no write on rejection.
**Commit boundary:** API and abuse test only. Reference: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/.

## Package C — form and Turnstile

### Task C1 — single file input

**Files:** Modify modules/kontakt.html; update tests/lead-form.test.mjs.
**Red test / run / expected fail:** One input, exact accept list, five-file limit; node --test tests/lead-form.test.mjs; input absent.
**Implement / pass:** Accessible native input; DOM assertions pass.
**Commit boundary:** Form/test.

### Task C2 — request ID/FormData

**Files:** Modify js/app.js; update form test.
**Red test / run / expected fail:** UUID header, JSON without files, multipart with files; run `node --test tests/lead-form.test.mjs`; JSON-only behavior.
**Implement / pass:** createRequestId(): string via crypto.randomUUID and submitLead(form): Promise<Response>; content types correct.
**Commit boundary:** App/test.

### Task C3 — Turnstile widget

**Files:** Modify form, app and translations; update form test.
**Red test / run / expected fail:** Both request types require token; run `node --test tests/lead-form.test.mjs`; widget absent.
**Implement / pass:** Public site-key widget/token injection, no secret or production bypass; tests pass.
**Commit boundary:** Form/app/translations/tests.

### Task C4 — error UX

**Files:** Modify app; update form test.
**Red test / run / expected fail:** 413/415/422/429/500, focus and duplicate suppression; run `node --test tests/lead-form.test.mjs`; generic/duplicate behavior.
**Implement / pass:** Neutral accessible messages; no filenames or personal upload data in analytics.
**Commit boundary:** App/test.

### Task C5 — output integrity

**Files:** Update tests/site-integrity.test.mjs; no redesign.
**Red test / run / expected fail:** Generated pages have one form/input and all languages; npm run build; node --test tests/site-integrity.test.mjs; assertions fail.
**Implement / pass:** Only required Eleventy wiring; output counts pass.
**Commit boundary:** Integrity test and necessary form/template.

### Task C6 — Package C acceptance

**Files:** C files/tests.
**Red test / run / expected fail:** No-JS semantics plus JSON/multipart; npm test; regression.
**Implement / pass:** Minimal corrections; complete suite passes.
**Commit boundary:** Package C files only.

### Task C7 — localized upload copy

**Files:** Modify js/translations.js and modules/kontakt.html; update tests/lead-form.test.mjs.
**Red test / run / expected fail:** German, Italian and English labels/errors include the same limits and formats; node --test tests/lead-form.test.mjs; locale assertions fail.
**Implement / pass:** Add translated, factual labels without promises; all locale assertions pass.
**Commit boundary:** Translation/form/test only.

## Package D — employee route, Access and audit

### Task D1 — Pages route mapping

**Files:** Create functions/internal/leads/[leadId]/uploads/[uploadId]/index.js, approve.js and reject.js; create root _routes.json; modify eleventy.config.mjs to include it in publicRootFiles; create tests/upload-routes.test.mjs.
**Red test / run / expected fail:** Exact URL resolution and output copy; node --test tests/upload-routes.test.mjs; files/config absent.
**Implement / pass:** Bracket segments map to /internal/leads/:leadId/uploads/:uploadId; _routes.json includes /api/leads and /internal/leads/*; after npm run build, _site/_routes.json exists.
**Commit boundary:** Route/config/test only.

### Task D2 — cryptographic Access JWT

**Files:** Create functions/internal/access-jwt.mjs; create tests/access-jwt.test.mjs.
**Red test / run / expected fail:** Missing token, wrong signature/algorithm/issuer/audience, exp/nbf and valid JWKS; node --test tests/access-jwt.test.mjs; verifier missing.
**Implement / pass:** verifyAccessJwt(assertion, {teamDomain, policyAud, fetchImpl, now}): Promise<{ok, subject?, reason?}> fetches Access JWKS, verifies with Web Crypto, checks algorithm, iss, aud, exp, nbf and employee/group identity. Missing/invalid returns neutral 401/403.
**Commit boundary:** Verifier/test.

### Task D3 — metadata/download

**Files:** Modify upload route; create tests/upload-download.test.mjs.
**Red test / run / expected fail:** Authorized quarantine download, wrong lead, missing token, headers and audit; node --test tests/upload-download.test.mjs; route absent.
**Implement / pass:** GET only, D1 lookup by both IDs, R2 get, attachment/nosniff headers and download_allowed/download_denied audit; no security transition.
**Commit boundary:** Route/test.

### Task D4 — approve/reject

**Files:** Modify action routes; extend download test.
**Red test / run / expected fail:** Employee action, repeat, non-employee and cross-lead; run `node --test tests/upload-download.test.mjs`; transitions absent.
**Implement / pass:** POST only, quarantine to approved/rejected, reviewer/time/reason and audit actions; neutral 409/404 on invalid transitions.
**Commit boundary:** Action routes/test.

### Task D5 — Package D acceptance

**Files:** D routes/verifier/tests.
**Red test / run / expected fail:** Complete access matrix and nine audit actions; two targeted test files; uncovered branch.
**Implement / pass:** Minimal fixes; employee-only metadata/download/review passes.
**Commit boundary:** Package D files only.

## Package E — cleanup Worker

### Task E1 — cleanup state machine

**Files:** Create workers/upload-cleanup.js; create tests/upload-cleanup.test.mjs.
**Red test / run / expected fail:** Pending older than 24h, failed, delete_pending, orphan, missing object, expired completed request, active processing and batch 100; node --test tests/upload-cleanup.test.mjs; Worker absent.
**Implement / pass:** runUploadCleanup(env, now): Promise<{processed, deleted, failed}> and scheduled handler; bounded idempotent deletion, audit actions and preservation of active/open records.
**Commit boundary:** Worker/test.

### Task E2 — binding/schedule separation

**Files:** Create wrangler.cleanup.jsonc; create tests/cleanup-config.test.mjs.
**Red test / run / expected fail:** Distinct preview/production names and daily Cron; node --test tests/cleanup-config.test.mjs; config absent.
**Implement / pass:** Preview DB_PREVIEW/RFQ_UPLOADS_PREVIEW and production DB/RFQ_UPLOADS; no cross-environment binding.
**Commit boundary:** Config/test.

### Task E3 — Package E acceptance

**Files:** E files/tests.
**Red test / run / expected fail:** Complete cleanup matrix; both E test files; state gap.
**Implement / pass:** Minimal correction; bounded repeatable audited cleanup.
**Commit boundary:** Package E files only.

## Package F — preview, privacy and release

### Task F1 — isolated preview

**Files:** Modify scripts/dev-preview.mjs only if routing requires; create tests/upload-preview.test.mjs.
**Red test / run / expected fail:** Localhost-only fake services and no production env; node --test tests/upload-preview.test.mjs; fixture absent.
**Implement / pass:** Local fake D1/R2/Turnstile, _site free of drafts, _preview only; tests pass.
**Commit boundary:** Preview/test.

### Task F2 — privacy/build integrity

**Files:** Modify docs/PRIVACY_DATA_FLOW.md and datenschutz/index.html; update integrity tests.
**Red test / run / expected fail:** No public R2 URLs, accurate notice, no draft leakage/personal analytics; npm test; assertions fail.
**Implement / pass:** Factual data-flow text only; suite/build output pass.
**Commit boundary:** Privacy/test only.

### Task F3 — browser verification

**Files:** None unless a defect is found.
**Red test / run / expected fail:** Synthetic desktop/mobile JSON/multipart, 413/429 and no-JS; npm test; npm run build; npm run dev:preview; regression blocks.
**Implement / pass:** Owning-package fix only; no real lead or production request.
**Commit boundary:** No release commit.

### Task F4 — preview gate

**Files:** Cloudflare preview settings, not changed here.
**Red test / run / expected fail:** Checklist for private preview bindings, test Turnstile and Access; manual checklist; missing evidence.
**Implement / pass:** Configure only after approval; synthetic preview smoke tests pass.
**Commit boundary:** Configuration requires separate approval.

### Task F5 — production gate

**Files:** Cloudflare production settings/deployment, not changed here.
**Red test / run / expected fail:** Synthetic release/rollback checklist; npm test; npm run build; git diff --check; any failed gate blocks.
**Implement / pass:** Create private R2, bind RFQ_UPLOADS, apply additive migrations to DB, set secrets and Access policy, deploy Pages/Worker and enable Cron only after approval.
**Commit boundary:** Deployment separate and approved.

### Task F6 — Package F acceptance

**Files:** F files/configuration.
**Red test / run / expected fail:** Complete evidence review; npm test; npm run build; git diff --check; missing evidence/regression.
**Implement / pass:** Preview/production separation, privacy accuracy and no draft/public-R2 leakage.
**Commit boundary:** No automatic deployment.

## Decisions before each package

- Before A: none; local parser/schema preparation only, migrations are not executed.
- Before B preview: preview D1/R2 names and fixtures, plus a decision on a Cloudflare Rate Limiting binding or a confirmed Cloudflare rate-limit rule. Without that decision, B preview cannot be activated.
- Before C preview: preview Turnstile site key/test mode.
- Before D preview: Access Team Domain, POLICY_AUD, employee group and JWKS test key.
- Before E preview: Worker binding map and Cron schedule.
- Before F production: production D1/R2 IDs, Turnstile secret, Access values, retention approval and deployment approval.

## Final consistency checklist

- Every table has a numbered migration and matching schema baseline.
- Upload rows contain server UUID, SHA-256, detected type, original name, key, size, timestamps and review data.
- Audit actions include allowed/denied downloads, storage, review and cleanup.
- Only quarantine to approved/rejected is allowed; download has no side effect.
- Bracket route files and _routes.json are copied by eleventy.config.mjs into _site.
- Multipart parsing is incremental, bounded, boundary-aware and independent of Content-Length trust.
- Turnstile is mandatory in the final state; backend and form are released together so JSON remains usable.
- Cleanup covers pending, failed, delete_pending, R2 orphans, missing objects and expired completed idempotency rows in batches of 100.
- No dependency is planned; Web Streams and Web Crypto are used.

## Official references

- https://developers.cloudflare.com/pages/functions/routing/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/pages/functions/wrangler-configuration/
- https://developers.cloudflare.com/r2/objects/upload-objects/
- https://developers.cloudflare.com/r2/reference/data-security/
- https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/
