<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# JUGAAD ONE — DUAL-AGENT ENGINEERING PROTOCOL

This codebase is co-developed by two AI engineering agents with equal ownership:
- **OpenAI Codex**
- **Google Antigravity**

Before making any changes, every agent must read and strictly follow these rules:

1. **Shared Single Source of Truth:**
   - Read `PRODUCT_SPEC.md` for architecture, design rules, and acceptance criteria.
   - Read `docs/DEVELOPMENT_HANDOFF.md` to see the current verified state, recent changes, and next recommended tasks.
   - When ending your shift, update `docs/DEVELOPMENT_HANDOFF.md` before reporting completion.

2. **Zero-Destruction Rule:**
   - Never run destructive cleanups (`rm -rf`, erasing untracked work, resetting repository).
   - Never overwrite or discard another agent's working code without rigorous justification.
   - Build incrementally upon existing working components.

3. **Secrets & Security:**
   - Never print, echo, expose, or commit secret keys from `.env.local`.
   - Never transmit credentials to third-party endpoints. Check only whether expected variables exist.

4. **Code Quality & Verification:**
   - Every modification must pass `npm test`, `npm run lint`, and `npm run typecheck`.
   - Never claim an integration or test passed unless it was actually executed and verified.
   - Do not use paid API credits for routine unit tests; use isolated fixtures and mock transports.

5. **Design System & Anti-Slop:**
   - Strictly adhere to `DESIGN_SYSTEM.md` and `PRODUCT_SPEC.md`.
   - No generic AI aesthetics (purple/blue gradient orbs, emoji dashboards, neon borders).
   - Maintain the warm paper (`#F8F5EE`), ink (`#161616`), and Jugaad orange (`#FF633A`) visual language.

6. **Dialogue and checkout**
   - Route conversational actions through the shared dialogue controller. Keep provider and sandbox tools separate from model inference.
   - Resolve repeat, redisplay and offer references against stored state. A model action alone cannot approve a quote, authorize payment or place an order.
   - Keep dialogue history bounded and preserve active hard constraints during corrections.
   - Keep dialogue action and subject domain separate. The discovery gate must allow only explicit discovery actions in compatible commerce domains.
   - Direct model replies and error recovery must have no commerce side effects. Keep diagnostics free of utterances, addresses and credentials.

7. **Takeover checkpoint**
   - Use the latest takeover section in `docs/DEVELOPMENT_HANDOFF.md` as the current verification snapshot. Keep the chronological log intact.
   - Check for Git metadata before referencing a branch, commit or diff. This workspace had none at the Codex handoff. Keep working files and local databases intact.
   - Separate live API, mocked or synthetic browser, physical microphone and production deployment evidence. Start with the recorded physical-mic regression before changing model or transport behavior.
