---
name: hermes-swarm-orchestrator
description: Orchestrate OpenRouter 3-tier worker agents via Hermes CLI and Antigravity Swarm while protecting the $5 OpenRouter balance and blocking >250K token cliffs.
---
# Hermes Swarm Orchestrator Skill

1. **Tier 1 (Antigravity Rolling Quota — Zero OpenRouter Cost):** `gemini-3.8-flash-*` and `gemini-4-hydrogen-*` spawned via Antigravity `swarm` tool.
2. **Tier 2 (OpenRouter Mundane Workers):** `z-ai/glm-5.3-flash` and `deepseek/deepseek-v4.1-flash` spawned via `hermes -p worker --in <PROJECT_DIR> -m <MODEL> -z "<PROMPT>"`.
3. **Tier 3 (Emergency Escalation Only — Capped <128K Context):** `anthropic/claude-haiku-5.5` and `openai/gpt-6-luna`.
