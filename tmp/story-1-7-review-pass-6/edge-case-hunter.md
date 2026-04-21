::code-comment{title="[P2] Bare /api still falls through to Vite SPA fallback in dev mode" body="The dev middleware only reserves paths whose pathname starts with `/api/`, so a request to `/api` bypasses the shell API handler and is rewritten by Vite to `index.html` with HTTP 200. I reproduced this against `npm run dev` (`curl -si http://127.0.0.1:4175/api` returned HTML), while preview delivery returns a non-HTML failure for the same path. That leaves a route/fallback gap in the documented local bootstrap flow: a mistyped health/proxy target can look healthy in dev instead of failing closed, and the current E2E coverage only exercises `/api/missing-endpoint`, so this regression stays untested." file="/home/pinto/repo/BMADGraphWebApp/vite.config.ts" start=70 end=76 priority=2 confidence=0.96}

Findings:
- P2: [vite.config.ts](/home/pinto/repo/BMADGraphWebApp/vite.config.ts:70) leaves bare `/api` outside the reserved namespace. Dev serves SPA HTML for `/api`, while preview does not, so local and hosted behavior diverge on an API-adjacent fallback path and the current test slice misses it.

I did not find other substantive scoped edge-case issues beyond that parity gap.
