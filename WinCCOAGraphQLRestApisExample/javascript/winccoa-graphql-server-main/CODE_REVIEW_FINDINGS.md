# Code Review Findings

Review scope: GraphQL and REST server implementation.

## 1. [P1] Login exemption bypasses auth for the whole operation — Fixed

Original file: `index.js:573-574`

Fixed in: `index.js`, `tests/suite-11-gql-auth.js`

The auth plugin returns as soon as any top-level field is named `login`, so a single unauthenticated mutation can include `login` plus other mutating fields. Because the operation is exempted before execution, those sibling mutations bypass both authentication and readonly checks.

Recommendation: Restrict the exemption to operations whose only root field is `login`, or move authorization into field-level guards.

Resolution: GraphQL auth now collects root mutation field names, including fragment selections, and only exempts a standalone `login` mutation. Added regression coverage for an unauthenticated `login` plus sibling mutation attempt.

## 2. [P1] GraphQL subscriptions use the global WinCC OA manager — Fixed

Original file: `index.js:260-263`

Fixed in: `index.js`

`buildContextAwareResolvers` only wraps direct function resolvers. Subscription fields are resolver objects with `subscribe`, so they are copied unchanged. Those `subscribe` functions close over the global `winccoa` from `createSubscriptionResolvers`, meaning WebSocket subscriptions do not use the per-session manager/user context.

Impact: This breaks session isolation and can run subscriptions under the wrong WinCC OA identity.

Recommendation: Make subscription resolver objects dispatch through `contextValue.v2Resolvers` or refactor subscription resolvers to use `context.winccoa`.

Resolution: Context-aware resolver dispatch now wraps resolver-object methods, including `subscribe` and `resolve`, so GraphQL subscriptions dispatch through the per-session resolver set when available.

## 3. [P1] Public debug endpoint leaks bearer tokens — Fixed

Original file: `index.js:712-727`

Fixed in: `index.js`

`/debug-headers` is unauthenticated and returns `allHeaders: req.headers`, including `authorization` and any proxy/session headers. On a remotely reachable server this exposes live credentials to anyone who can call the endpoint.

Recommendation: Remove this endpoint or gate it behind an explicit local-only/debug-only admin check, and never echo auth headers.

Resolution: Removed the public `/debug-headers` endpoint so request headers are no longer echoed.

## 4. [P2] Missing sessions fall back to global privileges — Fixed

Original file: `index.js:226-233`

Fixed in: `index.js`, `restapi/rest-api.js`

After a token validates, a missing session falls back to the global WinCC OA manager instead of rejecting the request. A request racing with logout or idle cleanup can therefore continue against the global manager after its per-user session was destroyed.

Recommendation: Treat a missing non-static session as unauthorized and return `401` or GraphQL `Unauthorized`.

Resolution: Missing non-static sessions now reject requests. GraphQL resource lookup throws `Unauthorized`, and REST auth returns `401` with `Session expired or invalid`.

## 5. [P2] Production auth can silently fall back to dev credentials — Fixed

Original file: `lib/auth.js:198-203`

Fixed in: `lib/auth.js`, `index.js`

When no configured users are present, `AUTH_MODE=config` accepts `dev/dev`, and the JWT secret also has a hardcoded default. This is useful locally but unsafe as a production default.

Recommendation: Gate dev credentials behind an explicit `NODE_ENV !== 'production'` or `ALLOW_DEV_LOGIN=true`, and fail startup when auth is enabled without credentials or a custom JWT secret.

Resolution: `dev/dev` now works only when `ALLOW_DEV_LOGIN=true` and `NODE_ENV` is not `production`. Production startup refuses the default JWT secret, and `AUTH_MODE=config` refuses to start without configured credentials.

## 6. [P2] tagSubscribe interpolates DPE names into dpQuery — Fixed

Original file: `graphql/subscriptions.js:290-292`

Fixed in: `graphql/subscriptions.js`

`dpeName` is inserted directly into a quoted dpQuery string. A crafted name containing quotes can alter the query instead of being treated as a datapoint name.

Recommendation: Validate allowed DPE syntax or escape single quotes before constructing the query.

Resolution: `tagSubscribe` now validates DPE names before composing the `dpQuery` and rejects names containing quote, backslash, or newline characters.

## 7. [P3] Readonly users cannot logout via GraphQL — Fixed

Original file: `index.js:581-583`

Fixed in: `index.js`

The readonly guard blocks every mutation except operations containing `login`, so `mutation { logout }` is forbidden for readonly JWT users even though logout is a session-management action.

Recommendation: Allowlist `logout` alongside `login`, preferably with stricter per-root-field auth logic.

Resolution: The readonly mutation guard now allows a standalone top-level `logout` mutation while continuing to block other mutations.

## 8. [P3] npm test targets a missing file — Fixed

Original file: `package.json:7-10`

Fixed in: `package.json`

The repository has a numbered integration runner at `tests/run-all.js`, but `npm test` still runs `node test-graphql.js`, which does not exist. This makes the standard test command fail before any tests run.

Recommendation: Point `npm test` at `node tests/run-all.js` or add separate scripts for full and suite-specific runs.

Resolution: `npm test` now runs `node tests/run-all.js`.
