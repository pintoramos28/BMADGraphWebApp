::code-comment{title="[P2] Dev middleware does not fail closed on manifest/support drift" body="The static delivery server validates that the canonical manifest and support-matrix stay aligned before reporting success, but the Vite dev middleware only parses and echoes the JSON. In the documented local flow, `/api/health` can still return `status: ok` and the dev endpoints can serve internally inconsistent bootstrap metadata, which weakens AC3 and AC5 for the local delivery path." file="/home/pinto/repo/BMADGraphWebApp/vite.config.ts" start=25 end=77 priority=2 confidence=0.92}

::code-comment{title="[P2] Acceptance evidence only exercises hosted preview, not the documented local dev flow" body="Story 1.7 requires the local and hosted shell paths to be exercised, but the E2E configuration always boots `preview:shell` and the added smoke suite only runs against that server. This leaves AC4 and AC5 only partially evidenced for the documented `npm run dev` path, especially around route fallback and fail-closed behavior in local delivery." file="/home/pinto/repo/BMADGraphWebApp/playwright.config.ts" start=12 end=16 priority=2 confidence=0.9}

**Findings**

1. Medium: The local Vite delivery path does not perform the same manifest/support consistency validation as the static shell server, so the documented dev flow can report healthy bootstrap metadata even when the canonical files have drifted. See [vite.config.ts](/home/pinto/repo/BMADGraphWebApp/vite.config.ts:25). This is an AC3/AC5 acceptance gap for local delivery.

2. Medium: The automated acceptance coverage only exercises the static hosted path via `preview:shell`; it does not exercise the documented local `npm run dev` flow. See [playwright.config.ts](/home/pinto/repo/BMADGraphWebApp/playwright.config.ts:12) and [shell-delivery.spec.ts](/home/pinto/repo/BMADGraphWebApp/tests/e2e/shell-delivery.spec.ts:27). That leaves AC4 and AC5 only partially evidenced for “local and hosted shell are exercised.”

No additional scope drift or workflow/status issues were evident from the scoped materials beyond the acceptance gaps above.
