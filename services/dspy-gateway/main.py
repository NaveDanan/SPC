from __future__ import annotations

import json
import os
import re
import socket
import time
import uuid
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

os.environ["LITELLM_LOCAL_MODEL_COST_MAP"] = "true"

from dotenv import dotenv_values, load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import dspy

ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)

MANAGED_ENV_KEYS = (
    "AI_API_URL",
    "AI_API_KEY",
    "AI_MODEL",
    "AI_PROVIDER",
    "AI_API_BASE",
    "AI_GATEWAY_API_KEY",
    "AI_GATEWAY_PORT",
    "VITE_AI_MODEL",
    "VITE_AI_API_KEY",
    "DSPY_API_KEY",
    "OPENAI_API_KEY",
    "DSPY_API_BASE",
    "DSPY_TEMPERATURE",
    "DSPY_MAX_TOKENS",
    "DSPY_TIMEOUT_SECONDS",
    "DSPY_GATEWAY_API_KEY",
    "DSPY_GATEWAY_PORT",
)

DEFAULT_GATEWAY_PORT = 8001
KNOWN_PROVIDER_PREFIXES = (
    "openai/",
    "azure/",
    "anthropic/",
    "bedrock/",
    "cohere/",
    "gemini/",
    "vertex_ai/",
    "groq/",
    "mistral/",
    "ollama/",
    "together_ai/",
    "huggingface/",
    "replicate/",
    "deepseek/",
    "xai/",
)


def sync_managed_env_from_root() -> None:
    values = dotenv_values(ENV_PATH)
    for key in MANAGED_ENV_KEYS:
        value = values.get(key)
        if value is None:
            os.environ.pop(key, None)
            continue
        os.environ[key] = str(value)


sync_managed_env_from_root()


def env_first(*keys: str) -> str | None:
    for key in keys:
        value = os.getenv(key)
        if value is None:
            continue
        trimmed = value.strip()
        if trimmed:
            return trimmed
    return None


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = ""


class ChatCompletionRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage] = Field(default_factory=list)
    temperature: float | None = None
    max_tokens: int | None = None
    stream: bool = False


AGENT_CHART_TYPES = {
    "individual",
    "pChart",
    "npChart",
    "xBarS",
    "xBarR",
    "ewma",
    "histogram",
    "scatterPlot",
}


class AgentRecommendationModel(BaseModel):
    chartType: Literal["individual", "pChart", "npChart", "xBarS", "xBarR", "ewma", "histogram", "scatterPlot"] | None = None
    yColumns: list[str] = Field(default_factory=list)
    yColumn: str | None = None
    xAxisColumn: str | None = None
    sampleSize: int | None = None
    chartLabel: str | None = None
    zAxisLabel: str | None = None
    yAxisLabel: str | None = None
    reason: str = ""


class AgentRecommendationEnvelope(BaseModel):
    recommendation: AgentRecommendationModel = Field(default_factory=AgentRecommendationModel)


class SPCConciseAdvice(dspy.Signature):
    """Provide concise SPC chart guidance with high consistency.

    Output style rules:
    - Maximum 5 bullets.
    - Each bullet 18 words or less.
    - No preamble, no restating the user prompt.
    - If info is missing, include up to 2 short clarifying questions.
    """

    language = dspy.InputField(desc="Language code: en or he")
    context = dspy.InputField(desc="Chat history and dataset context")
    user_request = dspy.InputField(desc="Latest user request")
    answer = dspy.OutputField(desc="Short, actionable SPC recommendation")


class DSPyGateway:
    def __init__(self) -> None:
        self._predictor: dspy.Predict | None = None
        self._model_name: str | None = None
        self._api_base: str | None = None
        self._env_mtime: float | None = None
        self._active_config: tuple[str, str | None, str, str | None] | None = None

    @staticmethod
    def _safe_api_base(api_base: str | None) -> str:
        if not api_base:
            return "(default)"
        parsed = urlparse(api_base)
        if not parsed.scheme or not parsed.netloc:
            return api_base
        return f"{parsed.scheme}://{parsed.netloc}"

    @staticmethod
    def _resolve_litellm_target(model_name: str, api_base: str | None) -> tuple[str, str | None]:
        normalized = model_name.strip()
        if not normalized:
            return normalized, None

        lowered = normalized.lower()
        if lowered.startswith(KNOWN_PROVIDER_PREFIXES):
            return normalized, None

        provider = env_first("AI_PROVIDER")
        if provider:
            return normalized, provider.strip().lower()

        # For custom OpenAI-compatible endpoints (vLLM, llama.cpp server, etc.),
        # require explicit provider when model id does not include it.
        if api_base:
            raise RuntimeError(
                "Missing AI_PROVIDER for AI_API_BASE with unprefixed AI_MODEL. "
                "If the served model ID does NOT contain the provider name "
                "(e.g: \"openai/<MODEL_ID>\") add the provider name in "
                "\"AI_PROVIDER\"; otherwise leave AI_PROVIDER empty."
            )

        return normalized, None

    def _reload_env_if_changed(self) -> None:
        try:
            mtime = ENV_PATH.stat().st_mtime
        except FileNotFoundError:
            mtime = None

        if mtime == self._env_mtime:
            return

        load_dotenv(dotenv_path=ENV_PATH, override=True)
        sync_managed_env_from_root()
        self._env_mtime = mtime
        self._predictor = None
        self._active_config = None
        self._model_name = None
        self._api_base = None

    def _configure(self) -> None:
        self._reload_env_if_changed()

        api_key = env_first("AI_API_KEY", "DSPY_API_KEY", "OPENAI_API_KEY", "VITE_AI_API_KEY")
        model_name = env_first("AI_MODEL", "VITE_AI_MODEL")
        api_base = env_first("AI_API_BASE", "DSPY_API_BASE")
        litellm_model_name, custom_llm_provider = self._resolve_litellm_target(model_name or "", api_base)
        temperature = float(os.getenv("DSPY_TEMPERATURE", "0"))
        max_tokens = int(os.getenv("DSPY_MAX_TOKENS", "220"))
        timeout_seconds = float(os.getenv("DSPY_TIMEOUT_SECONDS", "20"))

        normalized_model_name = model_name.strip().lower() if model_name else ""

        lm_kwargs: dict[str, object] = {
            "max_tokens": max_tokens,
            "timeout": timeout_seconds,
        }
        if not normalized_model_name.startswith("gpt"):
            lm_kwargs["temperature"] = temperature
        if api_key:
            lm_kwargs["api_key"] = api_key
        if api_base:
            lm_kwargs["api_base"] = api_base
        if custom_llm_provider:
            lm_kwargs["custom_llm_provider"] = custom_llm_provider

        if not model_name:
            raise RuntimeError(
                "Missing AI_MODEL. "
                "Set it in project root .env before calling /v1/chat/completions."
            )

        if not api_key:
            raise RuntimeError(
                "Missing AI_API_KEY. "
                "Set it in project root .env before calling /v1/chat/completions."
            )

        current_config = (model_name, api_base, api_key, custom_llm_provider)
        if self._predictor is not None and self._active_config == current_config:
            return

        lm = dspy.LM(litellm_model_name, **lm_kwargs)
        dspy.configure(lm=lm)
        self._predictor = dspy.Predict(SPCConciseAdvice)
        self._model_name = model_name
        self._api_base = api_base
        self._active_config = current_config

    @staticmethod
    def _is_agent_mode_system_message(content: str) -> bool:
        lowered = content.lower()
        return (
            "additional agent mode output requirement" in lowered
            or "agent mode is enabled" in lowered
            or "מצב agent" in lowered
            or "דרישת פלט נוספת במצב agent" in lowered
        )

    def _is_agent_mode(self, messages: list[ChatMessage]) -> bool:
        for message in messages:
            if message.role == "system" and self._is_agent_mode_system_message(message.content):
                return True

        for message in reversed(messages):
            if message.role != "user":
                continue
            lowered = message.content.lower()
            if "agent mode is enabled" in lowered or "מצב agent" in lowered:
                return True
            break

        return False

    @staticmethod
    def _extract_json_fence(content: str) -> dict[str, object] | None:
        match = re.search(r"```json\s*([\s\S]*?)```", content, flags=re.IGNORECASE)
        if not match:
            return None

        payload_text = match.group(1).strip()
        if not payload_text:
            return None

        try:
            parsed = json.loads(payload_text)
        except Exception:
            return None

        if not isinstance(parsed, dict):
            return None

        return parsed

    @staticmethod
    def _clean_optional_text(value: object | None) -> str | None:
        if not isinstance(value, str):
            return None
        trimmed = value.strip()
        return trimmed or None

    def _build_agent_envelope(self, content: str) -> AgentRecommendationEnvelope:
        parsed = self._extract_json_fence(content) or {}
        recommendation_raw = parsed.get("recommendation") if isinstance(parsed.get("recommendation"), dict) else {}
        recommendation_data = dict(recommendation_raw) if isinstance(recommendation_raw, dict) else {}

        y_columns_raw = recommendation_data.get("yColumns")
        if not isinstance(y_columns_raw, list):
            y_columns_raw = []
        y_columns = []
        for value in y_columns_raw:
            if isinstance(value, str):
                trimmed = value.strip()
                if trimmed and trimmed not in y_columns:
                    y_columns.append(trimmed)

        y_column_legacy = self._clean_optional_text(recommendation_data.get("yColumn"))
        if not y_columns and y_column_legacy:
            y_columns = [y_column_legacy]

        chart_type_raw = self._clean_optional_text(recommendation_data.get("chartType"))
        chart_type = chart_type_raw if chart_type_raw in AGENT_CHART_TYPES else None

        sample_size_raw = recommendation_data.get("sampleSize")
        sample_size = None
        if isinstance(sample_size_raw, (int, float)):
            sample_size = max(2, min(25, int(round(sample_size_raw))))

        x_axis_column = self._clean_optional_text(recommendation_data.get("xAxisColumn"))
        chart_label = self._clean_optional_text(recommendation_data.get("chartLabel"))
        z_axis_label = self._clean_optional_text(recommendation_data.get("zAxisLabel") or recommendation_data.get("xAxisLabel"))
        y_axis_label = self._clean_optional_text(recommendation_data.get("yAxisLabel"))
        reason = self._clean_optional_text(recommendation_data.get("reason")) or ""

        model = AgentRecommendationModel(
            chartType=chart_type,
            yColumns=y_columns,
            yColumn=y_columns[0] if y_columns else y_column_legacy,
            xAxisColumn=x_axis_column,
            sampleSize=sample_size,
            chartLabel=chart_label,
            zAxisLabel=z_axis_label,
            yAxisLabel=y_axis_label,
            reason=reason,
        )
        return AgentRecommendationEnvelope(recommendation=model)

    def _ensure_agent_mode_response(self, answer: str) -> str:
        envelope = self._build_agent_envelope(answer)
        json_block = json.dumps(envelope.model_dump(), ensure_ascii=False)
        narrative = re.sub(r"```json\s*[\s\S]*?```", "", answer, flags=re.IGNORECASE).strip()
        if not narrative:
            narrative = "- Applied agent recommendation to UI settings."
        return f"{narrative}\n\n```json\n{json_block}\n```"

    def answer(self, messages: list[ChatMessage]) -> str:
        self._configure()
        if self._predictor is None:
            raise RuntimeError("DSPy predictor is not configured")

        user_messages = [msg for msg in messages if msg.role == "user" and msg.content.strip()]
        latest_user = user_messages[-1].content.strip() if user_messages else ""
        if not latest_user:
            return "- Please ask one specific SPC question."

        language = "he" if re.search(r"[\u0590-\u05FF]", latest_user) else "en"

        history_fragments: list[str] = []
        for msg in messages[-12:]:
            if not msg.content.strip():
                continue
            if msg.role == "system" and not self._is_agent_mode_system_message(msg.content):
                continue
            history_fragments.append(f"{msg.role}: {msg.content.strip()}")

        context = "\n".join(history_fragments)
        prediction = self._predictor(language=language, context=context, user_request=latest_user)
        answer = getattr(prediction, "answer", "")
        response = str(answer).strip() or "- No recommendation generated."
        if self._is_agent_mode(messages):
            return self._ensure_agent_mode_response(response)
        return response


app = FastAPI(title="SPC DSPy Gateway", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

gateway = DSPyGateway()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready() -> dict[str, object]:
    gateway._reload_env_if_changed()

    model_name = env_first("AI_MODEL", "VITE_AI_MODEL") or ""
    api_base = env_first("AI_API_BASE", "DSPY_API_BASE") or ""
    provider = env_first("AI_PROVIDER") or ""
    has_api_key = bool(env_first("AI_API_KEY", "DSPY_API_KEY", "OPENAI_API_KEY", "VITE_AI_API_KEY"))

    if not model_name.strip():
        return {"ready": False, "reason": "Missing AI_MODEL", "model_source": "AI_MODEL"}
    if not has_api_key:
        return {"ready": False, "reason": "Missing AI_API_KEY", "model_source": "AI_MODEL"}
    if api_base.strip() and not model_name.strip().lower().startswith(KNOWN_PROVIDER_PREFIXES) and not provider.strip():
        return {"ready": False, "reason": "Missing AI_PROVIDER for AI_API_BASE with unprefixed AI_MODEL", "model_source": "AI_MODEL"}
    if not api_base.strip():
        return {"ready": True, "model": model_name, "api_base": "(provider default)", "model_source": "AI_MODEL"}

    parsed = urlparse(api_base)
    host = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if not host:
        return {"ready": False, "reason": "Invalid AI_API_BASE", "api_base": api_base}

    try:
        with socket.create_connection((host, port), timeout=2):
            pass
    except Exception as exc:
        return {
            "ready": False,
            "reason": "Upstream host unreachable",
            "model": model_name,
            "api_base": f"{parsed.scheme}://{parsed.netloc}",
            "model_source": "AI_MODEL",
            "error": str(exc),
        }

    return {
        "ready": True,
        "model": model_name,
        "api_base": f"{parsed.scheme}://{parsed.netloc}",
        "model_source": "AI_MODEL",
    }


@app.post("/v1/chat/completions")
def chat_completions(
    payload: ChatCompletionRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    required_gateway_key = env_first("AI_GATEWAY_API_KEY", "DSPY_GATEWAY_API_KEY") or ""
    if required_gateway_key:
        token = ""
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()
        if token != required_gateway_key:
            raise HTTPException(status_code=401, detail="Invalid API key")

    try:
        content = gateway.answer(payload.messages)
    except Exception as exc:  # pragma: no cover
        detail = str(exc) or "DSPy inference failed"
        if "Missing AI_API_KEY" in detail or "Missing AI_MODEL" in detail or "Missing AI_PROVIDER" in detail:
            raise HTTPException(status_code=503, detail=detail) from exc
        connectivity_markers = (
            "Connection error",
            "ConnectError",
            "ReadTimeout",
            "APIConnectionError",
            "Temporary failure in name resolution",
            "Name or service not known",
            "Connection refused",
        )
        if any(marker in detail for marker in connectivity_markers):
            safe_base = gateway._safe_api_base(env_first("AI_API_BASE", "DSPY_API_BASE") or gateway._api_base)
            model_name = env_first("AI_MODEL", "VITE_AI_MODEL") or gateway._model_name or "unknown"
            raise HTTPException(
                status_code=503,
                detail=(
                    "DSPy upstream connection failed. "
                    f"model={model_name}, api_base={safe_base}. "
                    "Verify AI_API_BASE points to your reachable self-hosted endpoint. "
                    f"Original error: {detail}"
                ),
            ) from exc
        raise HTTPException(status_code=500, detail=f"DSPy inference failed: {detail}") from exc

    created = int(time.time())
    response_model = env_first("AI_MODEL", "VITE_AI_MODEL") or "unknown"

    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:24]}",
        "object": "chat.completion",
        "created": created,
        "model": response_model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content,
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        },
    }


if __name__ == "__main__":
    import uvicorn

    gateway_port_value = env_first("AI_GATEWAY_PORT", "DSPY_GATEWAY_PORT") or str(DEFAULT_GATEWAY_PORT)

    try:
        gateway_port = int(gateway_port_value)
    except ValueError as exc:
        raise RuntimeError("Invalid AI_GATEWAY_PORT. It must be an integer.") from exc

    reload_value = (os.getenv("DSPY_GATEWAY_RELOAD") or "true").strip().lower()
    reload_enabled = reload_value in {"1", "true", "yes", "on"}

    uvicorn.run("main:app", host="0.0.0.0", port=gateway_port, reload=reload_enabled)
