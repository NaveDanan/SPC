# DSPy Gateway (SPC Assistant)

A small FastAPI service that wraps DSPy and exposes an OpenAI-compatible endpoint used by the SPA:

- `POST /v1/chat/completions`
- `GET /health`
- `GET /health/ready`

## Why

This gateway improves answer consistency by:

- forcing deterministic generation defaults (`temperature=0`)
- centralizing style constraints (short, bullet-based responses)
- using a structured DSPy signature instead of ad-hoc prompt concatenation

## Run locally

```bash
python -m venv .venv
# Windows:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
# Edit project root .env and set VITE_AI_API_URL / VITE_AI_API_KEY / VITE_AI_MODEL / DSPY_API_* / DSPY_GATEWAY_PORT
python main.py
```

The service runs on `http://localhost:${DSPY_GATEWAY_PORT}`.

## Front-end wiring

Set runtime config (`/config/runtime-config.js`) and point AI to the gateway:

```js
window.APP_CONFIG = {
	ENV: "local",
	FEATURES: {},
	AI: {
		API_URL: "",
		API_KEY: "",
		MODEL: "",
	},
};
```

## Notes

- If `DSPY_GATEWAY_API_KEY` is empty, auth is not enforced on the gateway.
- If `DSPY_GATEWAY_API_KEY` is set, `window.APP_CONFIG.AI.API_KEY` must match it.
- The gateway enforces `LITELLM_LOCAL_MODEL_COST_MAP=true` at startup, so LiteLLM uses bundled local metadata without remote fetch.
- `GET /health/ready` validates model/key config and basic upstream host reachability for `DSPY_API_BASE`.
- Optional: tune upstream timeout with `DSPY_TIMEOUT_SECONDS` (default `20`).
- Changes to root `.env` are reloaded automatically on the next request (no gateway restart required).
