# Eisenhutweg KIBH - Project Instructions

## AI Agent Fallback Procedure

To ensure uninterrupted operation during extended work sessions, we use a 3-tier model fallback strategy.

### Model Tiers
1.  **Tier 1: Claude 3.5/4.5 Sonnet** (Primary - High Quality)
2.  **Tier 2: Gemini 2.5 Flash** (Secondary - Free Tier, 15 RPM)
3.  **Tier 3: Local Ollama** (Tertiary - Unlimited, Qwen 2.5 Coder 7b / Llama 3.2 3b)

### Switching Models
If an agent hits rate limits (HTTP 429) or is blocked by quota:
1. Run `./switch_agent_model.sh <agent_id> <tier_number>` from the project root.
2. Example: `./switch_agent_model.sh cto 2`

### Infrastructure
- **Ollama Host**: `127.0.0.1:11434`
- **Preferred Local Model (Coding)**: `qwen2.5-coder:7b`
- **Preferred Local Model (Reasoning)**: `llama3.2:3b`

---
*Last Updated: 2026-06-09 (EIS-275)*
