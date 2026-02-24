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
# Edit project root .env and set AI_API_URL / AI_API_KEY / AI_MODEL
# Optional: AI_API_BASE (custom upstream URL), AI_GATEWAY_PORT (default: 8001)
python main.py
```

The service runs on `http://localhost:8001` by default.

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

- The gateway enforces `LITELLM_LOCAL_MODEL_COST_MAP=true` at startup, so LiteLLM uses bundled local metadata without remote fetch.
- `GET /health/ready` validates model/key config and basic upstream host reachability for `AI_API_BASE`.
- Changes to root `.env` are reloaded automatically on the next request (no gateway restart required).
