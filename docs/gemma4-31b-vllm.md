# Gemma 4 31B on vLLM for SPC

This project already has the right integration surface for a self-hosted reasoning model:

- SPA browser client
- optional DSPy gateway at `services/dspy-gateway`
- OpenAI-compatible upstream model server

For the highest-quality Gemma 4 option in this repo, use `google/gemma-4-31B-it` behind vLLM. If the full model is too heavy for your GPU host, keep the same integration and switch to a quantized 31B variant such as `nvidia/Gemma-4-31B-IT-NVFP4`.

## Recommended topology

For this codebase, prefer:

1. SPA -> DSPy gateway -> vLLM -> Gemma 4 31B

Why this is the best fit here:

- the SPA already speaks OpenAI chat completions
- the DSPy gateway keeps SPC answers short and structured
- the gateway already treats a custom `AI_API_BASE` as an OpenAI-compatible backend

Direct SPA -> vLLM also works, but you lose the DSPy consistency layer.

## Important Gemma 4 thinking note

Gemma 4 thinking is not enabled just by choosing the model. In vLLM, you should start the server with both:

- `--reasoning-parser gemma4`
- `--default-chat-template-kwargs '{"enable_thinking": true}'`

That matters in this repo because:

- the SPA does not send `chat_template_kwargs`
- the DSPy gateway does not send `chat_template_kwargs`
- the SPA only renders final `content` and ignores streamed `reasoning`

The result is still useful: Gemma 4 can think internally on the vLLM side, while this app continues to show only the final answer.

## Start vLLM

Run vLLM on a Linux GPU host or dedicated inference box. A practical baseline command is:

```bash
vllm serve google/gemma-4-31B-it \
  --host 0.0.0.0 \
  --port 8000 \
  --api-key spc-local-token \
  --dtype bfloat16 \
  --tensor-parallel-size 2 \
  --gpu-memory-utilization 0.92 \
  --max-model-len 32768 \
  --reasoning-parser gemma4 \
  --default-chat-template-kwargs '{"enable_thinking": true}' \
  --generation-config vllm
```

Notes:

- Increase or decrease `--tensor-parallel-size` to match your GPU count.
- `--max-model-len 32768` is a pragmatic cap for this SPC app. Gemma 4 supports longer contexts, but shorter limits reduce VRAM pressure.
- If you need to fit into less memory, load a quantized 31B variant instead and optionally keep the public name stable with `--served-model-name google/gemma-4-31B-it`.
- If the model download requires authentication, export your Hugging Face token before starting vLLM.

## Recommended repo wiring: DSPy gateway in front of vLLM

This is the best path for this project.

Create or update the repo root `.env`:

```dotenv
AI_API_URL=http://localhost:8001
AI_API_KEY=spc-local-token
AI_MODEL=google/gemma-4-31B-it
AI_API_BASE=http://host.docker.internal:8000/v1
DSPY_TEMPERATURE=0
DSPY_MAX_TOKENS=768
DSPY_TIMEOUT_SECONDS=60
```

Why these values:

- `AI_API_URL` points the SPA at the local DSPy gateway.
- `AI_API_BASE` points the gateway at vLLM's OpenAI-compatible endpoint.
- `DSPY_MAX_TOKENS=768` is intentionally higher than the repo default because thinking consumes part of the completion budget before the final answer is emitted.
- `DSPY_TEMPERATURE=0` matches the gateway's consistency-first design.

Windows note:

- If you run this repo with Docker Compose on Windows and vLLM is running on the same host, `host.docker.internal` is the easiest `AI_API_BASE` value.
- If the gateway is running directly on the host instead of in Docker, use `http://127.0.0.1:8000/v1`.
- If vLLM is remote, replace the host with the real hostname or IP.

Then start the app stack:

```bash
docker compose --env-file .env up -d --build
```

The frontend will be available at `http://localhost:8080` and the DSPy gateway at `http://localhost:8001`.

## Docker Compose runtime config detail

Compose mounts `deploy/docker/runtime-config.compose.js` into the frontend container. That file already points the browser at `http://localhost:8001` and uses a placeholder model name (`spc-dspy`).

That is fine for this setup because:

- the browser only needs a non-empty model string
- the DSPy gateway ignores the incoming request model and uses the upstream `AI_MODEL` from the root `.env`

If you decide to protect the gateway itself with `AI_GATEWAY_API_KEY`, update `deploy/docker/runtime-config.compose.js` so the browser sends the same bearer token.

## Browser-side runtime config for non-Compose usage

If you are not using Compose and want the browser to read a checked-in runtime config file instead of Vite env, point it at the gateway, not vLLM directly.

Example `public/config/runtime-config.js`:

```js
window.APP_CONFIG = {
  ENV: "local",
  FEATURES: {},
  AI: {
    API_URL: "http://localhost:8001",
    API_KEY: "spc-local-token",
    MODEL: "google/gemma-4-31B-it",
  },
};
```

When the DSPy gateway sits in front, the browser-side `MODEL` is mostly a client requirement. The real upstream model is selected from the gateway's root `.env`. Using the same `google/gemma-4-31B-it` value everywhere is the simplest option.

## Direct SPA -> vLLM option

If you want to skip DSPy and talk to vLLM directly, set the browser/runtime AI config to:

```dotenv
AI_API_URL=http://<your-vllm-host>:8000
AI_API_KEY=spc-local-token
AI_MODEL=google/gemma-4-31B-it
```

This works because the SPA automatically appends `/v1/chat/completions` if it is missing.

Use this mode only if you want raw model behavior. For SPC advice quality inside this repo, the DSPy gateway path is usually better.

## Quick checks

Verify vLLM is serving the model:

```bash
curl http://<your-vllm-host>:8000/v1/models \
  -H "Authorization: Bearer spc-local-token"
```

Verify the gateway can reach vLLM:

```bash
curl http://localhost:8001/health/ready
```

Send a quick chat request through the gateway:

```bash
curl http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer spc-local-token" \
  -d '{
    "model": "google/gemma-4-31B-it",
    "messages": [
      { "role": "user", "content": "Explain whether this dataset looks stable enough for an X-bar/R chart." }
    ]
  }'
```

## Limits and follow-up work

- The current SPA does not display streamed `delta.reasoning`, only the final `delta.content`.
- The current DSPy gateway does not expose per-request `thinking_token_budget` or `chat_template_kwargs`.
- If you want the UI to show Gemma 4's reasoning trace, you will need to extend the frontend stream parser and possibly the gateway response path.