::code-comment{title="[P2] Fresh-clone dev flow is documented but not acceptance-tested" body="Story 1.7 AC1 requires the documented local start flow to work via the hosted shell without an ad hoc mock server, but the scoped acceptance coverage only boots the built `preview:shell` path. Because the Playwright web server never exercises `npm run dev`, regressions in the Vite middleware endpoints or their fail-closed behavior would not be caught, so the local-dev half of the acceptance criteria is not fully evidenced." file="/home/pinto/repo/BMADGraphWebApp/playwright.config.ts" start=10 end=15 priority=2 confidence=0.93}

**Findings**

1. Medium: AC1 is not fully evidenced. [playwright.config.ts](/home/pinto/repo/BMADGraphWebApp/playwright.config.ts:10) and [tests/e2e/shell-delivery.spec.ts](/home/pinto/repo/BMADGraphWebApp/tests/e2e/shell-delivery.spec.ts:107) validate the built `preview:shell` delivery path, but not the documented fresh-clone `npm run dev` flow required by the story.

No additional substantive acceptance, scope-drift, or workflow-status issues were evident in the scoped materials.
