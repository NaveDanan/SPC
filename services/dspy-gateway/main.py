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


COMBINED_CA_BUNDLE_PATH = Path("/tmp/spc-combined-ca-bundle.pem")


def resolve_env_path() -> Path:
    override = os.getenv("SPC_ENV_FILE")
    if override:
        return Path(override).expanduser().resolve()

    current_file = Path(__file__).resolve()
    for parent in current_file.parents:
        candidate = parent / ".env"
        if candidate.is_file():
            return candidate

    return current_file.parent / ".env"


ENV_PATH = resolve_env_path()
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
    if not ENV_PATH.is_file():
        return

    values = dotenv_values(ENV_PATH)
    for key in MANAGED_ENV_KEYS:
        value = values.get(key)
        if value is None:
            os.environ.pop(key, None)
            continue
        os.environ[key] = str(value)


def configure_combined_ca_bundle() -> None:
    ca_bundle = None
    for key in ("REQUESTS_CA_BUNDLE", "SSL_CERT_FILE"):
        value = os.getenv(key)
        if value and value.strip():
            ca_bundle = value.strip()
            break
    if not ca_bundle:
        return

    custom_bundle_path = Path(ca_bundle)
    if custom_bundle_path == COMBINED_CA_BUNDLE_PATH:
        return

    if not custom_bundle_path.is_file():
        return

    try:
        import certifi

        certifi_path = Path(certifi.where())
        combined_bytes = certifi_path.read_bytes() + b"\n" + custom_bundle_path.read_bytes()
        if not COMBINED_CA_BUNDLE_PATH.is_file() or COMBINED_CA_BUNDLE_PATH.read_bytes() != combined_bytes:
            COMBINED_CA_BUNDLE_PATH.write_bytes(combined_bytes)
    except Exception:
        return

    combined_value = str(COMBINED_CA_BUNDLE_PATH)
    os.environ["REQUESTS_CA_BUNDLE"] = combined_value
    os.environ["SSL_CERT_FILE"] = combined_value
    os.environ["CURL_CA_BUNDLE"] = combined_value


sync_managed_env_from_root()
configure_combined_ca_bundle()


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


class AgentRecommendationHarness:
    @staticmethod
    def _clean_optional_text(value: object | None) -> str | None:
        if not isinstance(value, str):
            return None
        trimmed = value.strip()
        return trimmed or None

    @staticmethod
    def _clamp_sample_size(value: object | None) -> int | None:
        if isinstance(value, bool):
            return None
        if isinstance(value, (int, float)):
            return max(2, min(25, int(round(value))))
        if isinstance(value, str):
            match = re.search(r"\d+", value)
            if match:
                return max(2, min(25, int(match.group(0))))
        return None

    @staticmethod
    def _find_matching_brace_end(content: str, start: int) -> int | None:
        depth = 0
        in_string = False
        escape = False
        for index in range(start, len(content)):
            char = content[index]
            if in_string:
                if escape:
                    escape = False
                elif char == "\\":
                    escape = True
                elif char == '"':
                    in_string = False
                continue

            if char == '"':
                in_string = True
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return index + 1
        return None

    @classmethod
    def _extract_json_objects(cls, content: str) -> list[dict[str, object]]:
        candidates: list[str] = []
        for match in re.finditer(r"```json\s*([\s\S]*?)```", content, flags=re.IGNORECASE):
            payload = match.group(1).strip()
            if payload:
                candidates.append(payload)

        for match in re.finditer(r"\{\s*\"recommendation\"\s*:", content):
            end = cls._find_matching_brace_end(content, match.start())
            if end is not None:
                candidates.append(content[match.start():end])

        parsed_candidates: list[dict[str, object]] = []
        seen: set[str] = set()
        for candidate in candidates:
            if candidate in seen:
                continue
            seen.add(candidate)
            try:
                parsed = json.loads(candidate)
            except Exception:
                continue
            if isinstance(parsed, dict):
                parsed_candidates.append(parsed)

        return parsed_candidates

    @classmethod
    def strip_structured_blocks(cls, content: str) -> str:
        stripped = re.sub(r"```json\s*[\s\S]*?```", "", content, flags=re.IGNORECASE)
        spans: list[tuple[int, int]] = []
        for match in re.finditer(r"\{\s*\"recommendation\"\s*:", stripped):
            end = cls._find_matching_brace_end(stripped, match.start())
            if end is not None:
                spans.append((match.start(), end))

        for start, end in reversed(spans):
            stripped = stripped[:start] + stripped[end:]

        stripped = re.sub(r"\n?\s*(?:json\s*)?\{[\s\S]*\"recommendation\"[\s\S]*$", "", stripped, flags=re.IGNORECASE)
        stripped = re.sub(r"(?im)^\s*json\s*$", "", stripped)
        return stripped.strip()

    @classmethod
    def _normalize_from_data(cls, data: dict[str, object]) -> AgentRecommendationModel:
        recommendation_raw = data.get("recommendation") if isinstance(data.get("recommendation"), dict) else {}
        recommendation_data = dict(recommendation_raw) if isinstance(recommendation_raw, dict) else {}

        y_columns_raw = recommendation_data.get("yColumns")
        if not isinstance(y_columns_raw, list):
            y_columns_raw = []
        y_columns: list[str] = []
        for value in y_columns_raw:
            if isinstance(value, str):
                trimmed = value.strip()
                if trimmed and trimmed not in y_columns:
                    y_columns.append(trimmed)

        y_column_legacy = cls._clean_optional_text(recommendation_data.get("yColumn"))
        if not y_columns and y_column_legacy:
            y_columns = [y_column_legacy]

        chart_type_raw = cls._clean_optional_text(recommendation_data.get("chartType"))
        chart_type = chart_type_raw if chart_type_raw in AGENT_CHART_TYPES else None
        sample_size = cls._clamp_sample_size(recommendation_data.get("sampleSize"))
        x_axis_value = recommendation_data.get("xAxisColumn")
        x_axis_column = cls._clean_optional_text(x_axis_value)
        chart_label = cls._clean_optional_text(recommendation_data.get("chartLabel"))
        z_axis_label = cls._clean_optional_text(recommendation_data.get("zAxisLabel") or recommendation_data.get("xAxisLabel"))
        y_axis_label = cls._clean_optional_text(recommendation_data.get("yAxisLabel"))
        reason = cls._clean_optional_text(recommendation_data.get("reason")) or ""

        return AgentRecommendationModel(
            chartType=chart_type,  # type: ignore[arg-type]
            yColumns=y_columns,
            yColumn=y_columns[0] if y_columns else y_column_legacy,
            xAxisColumn=x_axis_column,
            sampleSize=sample_size,
            chartLabel=chart_label,
            zAxisLabel=z_axis_label,
            yAxisLabel=y_axis_label,
            reason=reason,
        )

    @staticmethod
    def _score(model: AgentRecommendationModel) -> int:
        score = 0
        if model.chartType:
            score += 4
        score += min(len(model.yColumns), 8) * 3
        if model.xAxisColumn is not None:
            score += 1
        if model.sampleSize:
            score += 2
        if model.chartLabel:
            score += 1
        if model.zAxisLabel:
            score += 1
        if model.yAxisLabel:
            score += 1
        if model.reason:
            score += 1
        return score

    @staticmethod
    def _recover_chart_type(content: str) -> Literal["individual", "pChart", "npChart", "xBarS", "xBarR", "ewma", "histogram", "scatterPlot"] | None:
        lowered = content.lower()
        chart_patterns: list[tuple[str, Literal["individual", "pChart", "npChart", "xBarS", "xBarR", "ewma", "histogram", "scatterPlot"]]] = [
            (r"\bx\s*[- ]?\s*bar\s*s\b|\bxbar\s*s\b|\bx-bar\s*s\b", "xBarS"),
            (r"\bx\s*[- ]?\s*bar\s*r\b|\bxbar\s*r\b|\bx-bar\s*r\b", "xBarR"),
            (r"\bi\s*[- ]?\s*mr\b|\bindividual\b|\bi chart\b", "individual"),
            (r"\bp\s*chart\b|\bproportion\b", "pChart"),
            (r"\bnp\s*chart\b", "npChart"),
            (r"\bewma\b", "ewma"),
            (r"\bhistogram\b", "histogram"),
            (r"\bscatter\s*plot\b", "scatterPlot"),
        ]
        for pattern, chart_type in chart_patterns:
            if re.search(pattern, lowered):
                return chart_type
        return None

    @staticmethod
    def _expand_column_range(prefix: str, start: str, end: str) -> list[str]:
        start_number = int(start)
        end_number = int(end)
        if end_number < start_number or end_number - start_number > 50:
            return []
        return [f"{prefix}{number}" for number in range(start_number, end_number + 1)]

    @classmethod
    def _recover_y_columns(cls, content: str) -> list[str]:
        columns: list[str] = []

        range_patterns = [
            r"\b([A-Za-z][A-Za-z0-9]*_)(\d+)\s*(?:through|to|-|–|—)\s*(?:[A-Za-z][A-Za-z0-9]*_)?(\d+)\b",
            r"\b([A-Za-z][A-Za-z0-9]*)(\d+)\s*(?:through|to|-|–|—)\s*(?:[A-Za-z][A-Za-z0-9]*)?(\d+)\b",
        ]
        for pattern in range_patterns:
            for match in re.finditer(pattern, content, flags=re.IGNORECASE):
                for column in cls._expand_column_range(match.group(1), match.group(2), match.group(3)):
                    if column not in columns:
                        columns.append(column)

        for match in re.finditer(r"\b[A-Za-z][A-Za-z0-9]*_\d+\b", content):
            column = match.group(0)
            if column not in columns:
                columns.append(column)

        return columns

    @classmethod
    def _recover_label(cls, content: str, names: tuple[str, ...]) -> str | None:
        joined = "|".join(re.escape(name) for name in names)
        pattern = rf"[\"']?(?:{joined})[\"']?\s*[:=]\s*[\"']?([^\"'\n\r]+)"
        match = re.search(pattern, content, flags=re.IGNORECASE)
        if not match:
            return None
        value = re.split(r"\s{2,}|[,;]|\.\s", match.group(1).strip(), maxsplit=1)[0].strip()
        return value or None

    @classmethod
    def _recover_from_narrative(cls, content: str) -> AgentRecommendationModel:
        chart_type = cls._recover_chart_type(content)
        y_columns = cls._recover_y_columns(content)
        sample_size = None

        sample_match = re.search(r"\b(?:sample|subgroup)\s*size\s*(?:of|=|:)?\s*(\d+)\b", content, flags=re.IGNORECASE)
        if sample_match:
            sample_size = cls._clamp_sample_size(sample_match.group(1))
        if sample_size is None and y_columns and chart_type in {"xBarS", "xBarR"}:
            sample_size = len(y_columns)

        chart_label = cls._recover_label(content, ("chartLabel", "chart label", "chart title"))
        z_axis_label = cls._recover_label(content, ("zAxisLabel", "xAxisLabel", "z axis label", "x axis label"))
        y_axis_label = cls._recover_label(content, ("yAxisLabel", "y axis label"))

        reason = ""
        reason_match = re.search(r"\breason\s*[:=]\s*([\s\S]+)$", content, flags=re.IGNORECASE)
        if reason_match:
            reason = re.sub(r"```json\s*[\s\S]*?```", "", reason_match.group(1), flags=re.IGNORECASE).strip()
            reason = reason.splitlines()[0].strip()
        if not reason and chart_type:
            bullets = [line.strip(" -\t") for line in content.splitlines() if line.strip().startswith(("-", "*"))]
            reason = bullets[0] if bullets else ""

        return AgentRecommendationModel(
            chartType=chart_type,
            yColumns=y_columns,
            yColumn=y_columns[0] if y_columns else None,
            xAxisColumn=None,
            sampleSize=sample_size,
            chartLabel=chart_label,
            zAxisLabel=z_axis_label,
            yAxisLabel=y_axis_label,
            reason=reason,
        )

    @classmethod
    def build_envelope(cls, content: str) -> AgentRecommendationEnvelope:
        models = [cls._normalize_from_data(candidate) for candidate in cls._extract_json_objects(content)]
        models.append(cls._recover_from_narrative(content))
        best = max(models, key=cls._score, default=AgentRecommendationModel())

        if best.sampleSize is None and best.chartType in {"xBarS", "xBarR"} and len(best.yColumns) > 1:
            best.sampleSize = len(best.yColumns)

        return AgentRecommendationEnvelope(recommendation=best)


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
    def _fallback_api_base() -> str | None:
        fallback = env_first("VITE_AI_API_URL")
        if not fallback:
            return None

        parsed = urlparse(fallback)
        if parsed.hostname in {"localhost", "127.0.0.1", "0.0.0.0"}:
            return None

        return fallback

    @staticmethod
    def _effective_api_base() -> str | None:
        return env_first("AI_API_BASE", "DSPY_API_BASE") or DSPyGateway._fallback_api_base()

    @staticmethod
    def _is_google_generative_api_base(api_base: str | None) -> bool:
        if not api_base:
            return False
        parsed = urlparse(api_base)
        return parsed.hostname == "generativelanguage.googleapis.com"

    @staticmethod
    def _normalize_api_base_for_provider(api_base: str | None, custom_llm_provider: str | None) -> str | None:
        if not api_base:
            return None

        parsed = urlparse(api_base)
        if custom_llm_provider == "gemini" and parsed.hostname == "generativelanguage.googleapis.com":
            return None

        return api_base

    @staticmethod
    def _gemini_model_name(model_name: str) -> str:
        return model_name if model_name.lower().startswith("gemini/") else f"gemini/{model_name}"

    @staticmethod
    def _resolve_litellm_target(model_name: str, api_base: str | None) -> tuple[str, str | None, str | None]:
        normalized = model_name.strip()
        if not normalized:
            return normalized, None, api_base

        lowered = normalized.lower()
        if lowered.startswith(KNOWN_PROVIDER_PREFIXES):
            provider_from_prefix = lowered.split("/", 1)[0]
            return normalized, None, DSPyGateway._normalize_api_base_for_provider(api_base, provider_from_prefix)

        provider = env_first("AI_PROVIDER")
        if provider:
            custom_provider = provider.strip().lower()
            if custom_provider == "gemini":
                return DSPyGateway._gemini_model_name(normalized), None, DSPyGateway._normalize_api_base_for_provider(api_base, custom_provider)
            return normalized, custom_provider, DSPyGateway._normalize_api_base_for_provider(api_base, custom_provider)

        if lowered.startswith("gemini-") or DSPyGateway._is_google_generative_api_base(api_base):
            return DSPyGateway._gemini_model_name(normalized), None, DSPyGateway._normalize_api_base_for_provider(api_base, "gemini")

        # Most self-hosted or gateway endpoints exposed via a custom base URL are
        # OpenAI-compatible, so default to LiteLLM's openai provider when a
        # provider-prefixed model name is not supplied.
        if api_base:
            return normalized, "openai", api_base

        return normalized, None, api_base

    def _reload_env_if_changed(self) -> None:
        try:
            mtime = ENV_PATH.stat().st_mtime
        except FileNotFoundError:
            mtime = None

        if mtime == self._env_mtime:
            return

        load_dotenv(dotenv_path=ENV_PATH, override=True)
        sync_managed_env_from_root()
        configure_combined_ca_bundle()
        self._env_mtime = mtime
        self._predictor = None
        self._active_config = None
        self._model_name = None
        self._api_base = None

    def _configure(self) -> None:
        self._reload_env_if_changed()

        api_key = env_first("AI_API_KEY", "DSPY_API_KEY", "OPENAI_API_KEY", "VITE_AI_API_KEY")
        model_name = env_first("AI_MODEL", "VITE_AI_MODEL")
        api_base = env_first("AI_API_BASE", "DSPY_API_BASE") or self._fallback_api_base()
        litellm_model_name, custom_llm_provider, api_base = self._resolve_litellm_target(model_name or "", api_base)
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

    def _build_agent_envelope(self, content: str) -> AgentRecommendationEnvelope:
        return AgentRecommendationHarness.build_envelope(content)

    def _ensure_agent_mode_response(self, answer: str) -> str:
        envelope = self._build_agent_envelope(answer)
        json_block = json.dumps(envelope.model_dump(), ensure_ascii=False)
        narrative = AgentRecommendationHarness.strip_structured_blocks(answer)
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
    model_lower = model_name.strip().lower()
    is_inferable_gemini = (
        model_lower.startswith("gemini-")
        or DSPyGateway._is_google_generative_api_base(api_base)
    )
    if (
        api_base.strip()
        and not model_lower.startswith(KNOWN_PROVIDER_PREFIXES)
        and not provider.strip()
        and not is_inferable_gemini
    ):
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
        rate_limit_markers = (
            "RateLimitError",
            "rate limit",
            "429",
            "Too Many Requests",
        )
        if any(marker.lower() in detail.lower() for marker in rate_limit_markers):
            safe_base = gateway._safe_api_base(gateway._effective_api_base() or gateway._api_base)
            model_name = env_first("AI_MODEL", "VITE_AI_MODEL") or gateway._model_name or "unknown"
            raise HTTPException(
                status_code=429,
                detail=(
                    "DSPy upstream provider rate limited this request. "
                    f"model={model_name}, api_base={safe_base}. "
                    "If you are using a free OpenRouter model, wait and retry, or switch to a different model. "
                    f"Original error: {detail}"
                ),
            ) from exc
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
            safe_base = gateway._safe_api_base(gateway._effective_api_base() or gateway._api_base)
            model_name = env_first("AI_MODEL", "VITE_AI_MODEL") or gateway._model_name or "unknown"
            raise HTTPException(
                status_code=503,
                detail=(
                    "DSPy upstream connection failed. "
                    f"model={model_name}, api_base={safe_base}. "
                    "Verify the upstream provider base URL is reachable and matches the configured model/provider. "
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
