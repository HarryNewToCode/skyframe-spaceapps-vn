# AGENTS.md — Project Storm-72H Worker Rules & Token Budget Guardrails

You are an autonomous worker agent building **Slice 1: "THE 72-HOUR STORM" (Artemis Base Camp Valve-and-Breaker Crisis Flight Deck + Sabatier Mass-Flow Schematic)** for the 2026 NASA Space Apps Challenge.

## 1. Strict File Ownership & Context Window Hygiene (<50K Tokens Target, Hard Stop <128K)
- You MUST ONLY create or modify the exact file(s) listed under `FILES OWNED` in your task brief.
- NEVER modify `src/contracts/types.ts` unless your task explicitly owns it. Import all shared types from `../contracts/types`.
- **TOKEN CLIFF PROTECTION (CRITICAL):**
  - NEVER read `package-lock.json`, `node_modules`, `dist/`, or unrelated source files. Read ONLY `src/contracts/types.ts`, `src/data/nasaCrisisData.ts` (if needed), and your owned file(s).
  - When running terminal checks, always pipe or limit output (e.g., `npx tsc --noEmit | head -n 40` or `npx vitest run --reporter=dot`) so verbose stack traces never bloat your context window.
  - Complete your task within 12 tool calls. If a test fails twice, stop immediately and report the exact error line rather than looping.

## 2. Scientific Grounding & NASA Attribution
- Never invent arbitrary numbers. Use the constants exported from `src/data/nasaCrisisData.ts` (grounded in NASA BVAD NASA/TP-2015-218570/REV2, LRO LOLA Shackleton Connecting Ridge 89.47°S horizon mask, August 4 1972 Solar Particle Event GOES/King 1974 flux, LRO CRaTER / NASA OLTARIS water-wall attenuation, and NASA-STD-3001 dose/CO2 limits).
- Preserve all `sourceUrl`, `citation`, and `formulaUsed` strings verbatim so every gauge's `[CITE]` flip-switch and the NASA Science Inspector remain 100% verifiable.

## 3. Anti-AI-Slop UI Rules
- Theme: Tactical NASA Flight Deck (`#090D16` background, `#111827` panels, `#1E293B` 1px borders, `#F59E0B` solar amber, `#06B6D4` ECLSS water/O2 cyan, `#10B981` bio emerald, `#A855F7` CH4 methane bleed violet, `#EF4444` radiation crimson).
- Use `font-mono tabular-nums` for all numeric telemetry, units (`kW`, `kWh`, `kg`, `L`, `mmHg`, `mSv/hr`, `mSv`), and formulas.
- ZERO raw emojis anywhere in JSX or strings. Use inline geometric SVG icons or `lucide-react` icons.

## 4. Definition of Done & Graceful Shutdown (No Indefinite Waiting)
- Run `npx tsc --noEmit | head -n 40` (and `npx vitest run` if your task includes tests) before finishing.
- Once your owned file is written and passes checks, report completion and exit cleanly without polling.
