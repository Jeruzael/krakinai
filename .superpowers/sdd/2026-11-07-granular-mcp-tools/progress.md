# SDD ledger — plan: docs/superpowers/plans/2026-11-07-granular-mcp-tools.md

## Pre-flight
- Task 1 -> Task 4: Staging engine exports match ProposalBroker handler requirements.
- Task 2 -> Task 4: Granular read exports match ProposalBroker query requirements.
- Task 3 -> Task 4: ProposalInbox in-place draft updates and discard match ProposalBroker inbox mutations.
- Pre-flight: shared interfaces aligned.

Task 1: complete (staged files: src/domain/mcpGranularStaging.ts, src/__tests__/mcpGranularStaging.test.ts, tests: vitest run src/__tests__/mcpGranularStaging.test.ts → 4/4 pass, tsc --noEmit → exit 0)

Task 2: complete (staged files: src/domain/mcpGranularReads.ts, src/__tests__/mcpGranularReads.test.ts, tests: vitest run src/__tests__/mcpGranularReads.test.ts → 4/4 pass)

Task 3: complete (staged files: src/types/proposalReview.ts, src/storage/proposalReviewInbox.ts, src/connections/proposalInbox.ts, src/__tests__/mcpGranularBroker.test.ts, tests: vitest run src/__tests__/mcpGranularBroker.test.ts → 1/1 pass)

Task 4: complete (staged files: src/domain/mcpProtocol.ts, src/connections/proposalBroker.ts, bridge/src/registerTools.ts, bridge/test/schemaDiscovery.test.ts, src/__tests__/blockingMcpCapabilities.test.ts, src/__tests__/keyframeMcpProjection.test.ts, src/__tests__/mcpGranularBroker.test.ts, tests: 23/23 pass across granular suites, 75/75 bridge tests pass, 1672/1672 main repo tests pass, tsc --noEmit → exit 0)
