# The 25 pre-launch controls

Each control states what PASS means, how to check it, and when it is legitimately N/A. Stack hints are starting points, not exhaustive.

## A. Secrets & configuration

### 1. Hide API keys
- **PASS:** no secret is in source code, client bundles, or committed config. Secrets come from env vars, a secret manager (SSM, Secrets Manager, Vault), or CI secrets/OIDC.
- **Check:** grep for key patterns (`sk_`, `pk_live`, `AKIA`, `ghp_`, `xox[bp]-`, `AIza`, `-----BEGIN`, `password=`, `token=`, `secret`). Read `.env*` handling and `.gitignore`. Inspect built client output (`dist/`, `.next/static`) for secrets, and check that only intentionally public vars are exposed to the client (`PUBLIC_`, `NEXT_PUBLIC_`, `VITE_`).
- **N/A:** never.

### 2. Remove secrets from Git history
- **PASS:** the full history is clean, or every leaked secret was **rotated** (removing it from history is not enough). Secret scanning runs in CI or pre-commit.
- **Check:** `gitleaks detect --source . --log-opts="--all"` or `trufflehog git file://. --only-verified` when installed. Otherwise `git log -p --all -S '<pattern>'` for the patterns of #1. Check whether CI or a hook includes secret scanning.
- **N/A:** not a git repository (then report VERIFY for the real source of truth).

### 3. Public key only for the database client
- **PASS:** the browser or mobile app uses only the restricted, public client key (Supabase `anon`/publishable, Firebase web config). Admin keys (`service_role`, service accounts, DB connection strings) exist only server-side.
- **Check:** search the client code and bundles for `service_role`, `serviceAccount`, `DATABASE_URL`, `postgres://`, `mongodb+srv://`.
- **N/A:** the client never talks to a database directly.

## B. Data & access

### 4. Row-Level Security
- **PASS:** every table reachable with the public key has RLS enabled and policies scoped to the owner or role (Supabase/Postgres RLS, Firebase security rules). No `using (true)` on private data.
- **Check:** migrations and `supabase/` SQL for `enable row level security` and policies; `firestore.rules` / `storage.rules`. Remote state cannot be verified from code: propose the query for the user to run.
- **N/A:** no client-exposed database.

### 5. Encrypt sensitive data
- **PASS:** encryption at rest is enabled for databases, buckets, queues, and backups. Highly sensitive fields (IDs, health, payment tokens) get field-level encryption or are not stored at all. TLS is used in transit to the DB.
- **Check:** IaC encryption settings (`encryption`, `kmsKey`, `storageEncrypted`), DB connection `sslmode`, and the inventory of the PII actually stored.
- **N/A:** no data persisted anywhere.

### 7. Restrict access to records (authorization / IDOR)
- **PASS:** every read or write of a record checks that the caller owns it or has the role for it, on the server. IDs in URLs or bodies are never trusted on their own.
- **Check:** handlers that take an `id` (`/api/x/[id]`, `params.id`, `req.body.userId`): look for an ownership or role check before the query.
- **N/A:** no per-user or per-tenant data.

### 13. Parameterize queries
- **PASS:** all SQL/NoSQL goes through parameters, an ORM, or a query builder. No string concatenation or template literals with input.
- **Check:** grep for `query(\`` with `${`, `"SELECT ... " +`, `.raw(`, `$queryRawUnsafe`, `execute(f"`, and Mongo `$where`.
- **N/A:** no database queries.

## C. Identity & session

### 6. Enforce authentication
- **PASS:** every non-public route, API, and server action requires auth by default (deny-by-default middleware), not page by page. Internal endpoints are not publicly reachable.
- **Check:** middleware/proxy matchers, route guards, server actions, API handlers, function URLs (`authType: NONE`?), admin panels, and staging environments.
- **N/A:** a fully public site with no private routes or APIs. Still check that internal endpoints are protected.

### 9. Protect session cookies
- **PASS:** session cookies are `HttpOnly`, `Secure`, `SameSite=Lax/Strict`, with a sensible expiry, rotation on login, and invalidation on logout. Tokens are not kept in `localStorage`.
- **Check:** cookie-setting code and auth-library config (`cookies().set`, `res.cookie`, NextAuth/Auth.js, Clerk, Supabase SSR).
- **N/A:** no sessions or logins.

### 10. Hash passwords
- **PASS:** passwords use argon2id, bcrypt, or scrypt (never MD5/SHA*/plain), or authentication is fully delegated to a provider.
- **Check:** grep `password`, `createHash`, `md5`, `sha1`, `sha256` near user creation and login.
- **N/A:** no local passwords (delegated auth or no auth). State which.

### 23. Expiring, single-use tokens and links
- **PASS:** password-reset links, magic links, email-verification links, and invitations use unguessable tokens (CSPRNG, ≥128 bits), are single-use, expire quickly (reset/magic link ≤ 1 h, invites ≤ 7 days), are stored hashed, and are invalidated on password change. Reset requests don't reveal whether an account exists.
- **Check:** token generation (`crypto.randomBytes`/`randomUUID` vs `Math.random`), expiry columns or TTL, the consumption logic (deleted or marked used?), and the auth provider's link-expiry settings (propose the console check to the user).
- **N/A:** no reset, magic, verification, or invite links.

## D. Input & output handling

### 8. Block field manipulation (mass assignment)
- **PASS:** writes copy only an allow-list of fields. Clients cannot set `role`, `isAdmin`, `price`, `ownerId`, `status`, or similar.
- **Check:** `create(req.body)`, `update({...body})`, `Object.assign(model, input)`, and spread of untrusted input into DB writes or queue messages.
- **N/A:** no write endpoints.

### 14. Validate inputs
- **PASS:** every server entry point validates type, length, format, and enum against a schema (zod, valibot, yup, or explicit checks) and caps the body size. Client-side validation alone does not count.
- **Check:** each handler, server action, webhook (including signature verification), and queue consumer.
- **N/A:** never if any input exists.

### 15. Sanitize content
- **PASS:** untrusted data is escaped for its output context (HTML, email, Markdown, URLs, logs, CSV). `dangerouslySetInnerHTML`, `set:html`, and `v-html` receive only sanitized input (DOMPurify).
- **Check:** grep the raw-HTML sinks, email templates, and `href` built from input (`javascript:` URLs).
- **N/A:** no user content is ever rendered or sent.

### 16. Restrict files (uploads)
- **PASS:** uploads check type by content (not extension), cap size, rename files, are stored outside the web root or in a private bucket, and are served via signed URLs with the correct `Content-Type`/`Content-Disposition`.
- **Check:** multipart handlers, presigned upload URLs and their conditions, bucket policies/ACLs, and storage rules.
- **N/A:** no file uploads.

### 17. Return only the necessary data
- **PASS:** responses use explicit DTOs/selects. No password hashes, internal IDs, emails of other users, stack traces, or verbose errors reach the client.
- **Check:** `select *` / `findMany()` returned as is, error handlers, debug flags in production, and server-to-client props in SSR frameworks.
- **N/A:** no dynamic responses.

### 22. Verify webhook signatures
- **PASS:** every incoming webhook (Stripe, GitHub, Clerk, Supabase, payment or messaging providers) verifies the provider's signature against the **raw** body with a constant-time comparison, rejects stale timestamps (replay protection), and handles events idempotently (event id stored). The secret lives server-side.
- **Check:** webhook routes (`/api/webhook*`, `/hooks/`), use of `constructEvent`/`verify` helpers or HMAC code, whether the body is parsed before verification (which breaks it), timestamp tolerance, and duplicate-event handling.
- **N/A:** no incoming webhooks.

## E. Abuse prevention

### 11. Rate limiting
- **PASS:** public endpoints that cost money or can be abused (login, signup, forms, password reset, AI/LLM calls, email/SMS sending) are limited per IP or user at the edge (WAF, API Gateway throttling) or in the app (Upstash, a Redis counter).
- **Check:** WAF rules in IaC, gateway throttles, and middleware. Note: concurrency caps on a background worker do not limit public callers.
- **N/A:** no dynamic public endpoints.

### 12. Bot protection
- **PASS:** public forms and auth flows use at least one bot control: honeypot plus timing, Turnstile/hCaptcha/reCAPTCHA, or a managed bot WAF rule.
- **Check:** form components and their server-side enforcement. A client-only check does not count.
- **N/A:** no public forms or auth flows.

## F. Transport & platform

### 18. Security headers
- **PASS:** `Content-Security-Policy` (at least `default-src 'self'`, `frame-ancestors`, `object-src 'none'`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and clickjacking protection (`frame-ancestors` or `X-Frame-Options`). CORS is not `*` on credentialed APIs.
- **Check:** IaC (CloudFront response headers policy), `next.config` headers, `vercel.json`, `_headers`, and middleware. Live check with the user's OK: `curl -sI https://<url>`.
- **N/A:** never for anything served over HTTP.

### 19. Enforce HTTPS
- **PASS:** HTTP redirects to HTTPS everywhere, including APIs and subdomains. HSTS is set. The certificate auto-renews. There is no mixed content.
- **Check:** viewer protocol policy, redirects, hardcoded `http://` URLs, and the certificate source.
- **N/A:** never.

### 21. Lock down CORS
- **PASS:** APIs allow only the explicit origins that need them (no `*` with credentials, no reflecting the request `Origin` back unchecked, no `null` origin). Methods and headers are allow-listed. Same-origin APIs send no CORS headers at all.
- **Check:** CORS config in the framework (`cors()` options, `Access-Control-Allow-*` in middleware, `next.config`, `vercel.json`), API Gateway / Function URL / S3 CORS settings in IaC, and Supabase/Firebase allowed origins. Live check with the user's OK: `curl -sI -H "Origin: https://evil.example" <api>`.
- **N/A:** no API, or the API is same-origin only and sends no CORS headers (state how it's served).

## G. Supply chain

### 20. Scan dependencies
- **PASS:** lockfiles are committed and installs are lockfile-exact (`npm ci`). CI fails on high/critical advisories (with a reviewed, expiring allow-list). Dependabot/Renovate is enabled. CI actions are pinned to commit SHAs.
- **Check:** CI workflows, `npm audit --omit=dev` (or `pip-audit`, `osv-scanner`), the Dependabot/Renovate config, and lifecycle-script policy (`--ignore-scripts`).
- **N/A:** never if there are third-party dependencies.

## H. Accounts & operations

### 24. MFA on platform accounts
- **PASS:** every account that can change code, infrastructure, DNS, email, or data has MFA enabled (prefer passkeys/TOTP over SMS) for every member: git host, cloud provider (root account with MFA and no access keys; IAM users or SSO with MFA), deploy platform, DNS registrar, email admin, database console, CRM, payment provider, and social/business managers. The organization enforces MFA where the platform allows it. Recovery codes are stored safely, and former members are removed.
- **Check:** infer the account list from the repo (git remote, IaC provider, deploy config, DNS and email references, SDKs). The repo can show org policies only rarely, so report the list as `VERIFY` with one line per account for the user to confirm ("MFA on? enforced for the org? who has access?").
- **N/A:** never.

### 25. Backups with a tested restore
- **PASS:** every store of data that can't be rebuilt from git (databases, uploaded files, CRM, critical config) has automated backups at least daily (or point-in-time recovery), retention that matches the data policy, a copy outside the primary account or region for critical data, and **a restore that has been tested** and recorded (date, what was restored, duration). Who restores and how is documented.
- **Check:** IaC backup settings (`backupRetention`, `pointInTimeRecovery`, AWS Backup plans, S3 versioning and replication), the database provider's plan (Supabase PITR or daily backups by tier), and documented restore tests. SaaS data (CRM, email) relies on the vendor: record that and whether an export exists.
- **N/A:** no state outside git (a static site rebuilt from the repository). State it.
