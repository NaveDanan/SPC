from __future__ import annotations

import json
import mimetypes
import os
import re
import socket
import time
import uuid
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlparse

os.environ["LITELLM_LOCAL_MODEL_COST_MAP"] = "true"

from dotenv import dotenv_values, load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

import dspy
import litellm


COMBINED_CA_BUNDLE_PATH = Path("/tmp/spc-combined-ca-bundle.pem")
BUNDLED_CA_BUNDLE_PATH = Path(os.getenv("SPC_DEFAULT_CA_BUNDLE", "/app/certs/bluecoat-ca-bundle.pem"))
FRONTEND_INDEX_FILE = "index.html"
DEFAULT_GATEWAY_API_KEY = "e696c6b7ce2f111bc0b9cd731f3d314fc862ebe193b2cd29d01c3f396ac4a1f9"


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
    if not ca_bundle and BUNDLED_CA_BUNDLE_PATH.is_file():
        ca_bundle = str(BUNDLED_CA_BUNDLE_PATH)
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


def resolve_frontend_dist_path() -> Path | None:
    override = os.getenv("SPC_WEB_DIST_DIR")
    if override:
        candidate = Path(override).expanduser().resolve()
        if candidate.is_dir():
            return candidate

    current_file = Path(__file__).resolve()
    candidates = (
        current_file.parent / "spc-web-dist",
        current_file.parents[2] / "dist",
    )
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved.is_dir():
            return resolved

    return None


def build_runtime_app_config() -> dict[str, object]:
    gateway_api_key = env_first("AI_GATEWAY_API_KEY", "DSPY_GATEWAY_API_KEY") or DEFAULT_GATEWAY_API_KEY
    ai_model = env_first("AI_MODEL", "VITE_AI_MODEL") or ""

    return {
        "ENV": os.getenv("APP_ENV") or "runtime",
        "FEATURES": {},
        "AI": {
            "API_URL": "/",
            "API_KEY": gateway_api_key,
            "MODEL": ai_model,
        },
    }


def runtime_config_response() -> Response:
    sync_managed_env_from_root()
    config_payload = json.dumps(build_runtime_app_config(), ensure_ascii=True, indent=2)
    return Response(content=f"window.APP_CONFIG = {config_payload};\n", media_type="application/javascript")


sync_managed_env_from_root()
configure_combined_ca_bundle()
FRONTEND_DIST_DIR = resolve_frontend_dist_path()


def env_first(*keys: str) -> str | None:
    for key in keys:
        value = os.getenv(key)
        if value is None:
            continue
        trimmed = value.strip()
        if trimmed:
            return trimmed
    return None


def frontend_file_response(relative_path: str) -> FileResponse | None:
    if FRONTEND_DIST_DIR is None:
        return None

    sanitized_path = relative_path.strip("/")
    target = (FRONTEND_DIST_DIR / sanitized_path).resolve() if sanitized_path else (FRONTEND_DIST_DIR / FRONTEND_INDEX_FILE).resolve()
    if not target.is_relative_to(FRONTEND_DIST_DIR) or not target.is_file():
        return None

    media_type, _ = mimetypes.guess_type(str(target))
    return FileResponse(target, media_type=media_type)


def frontend_index_response() -> FileResponse:
    response = frontend_file_response("")
    if response is None:
        raise HTTPException(status_code=503, detail="SPC-web assets are not available")
    return response


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str | None = ""
    tool_call_id: str | None = None
    tool_calls: list[dict[str, object]] = Field(default_factory=list)


class ChatToolDefinition(BaseModel):
    type: Literal["function"] = "function"
    function: dict[str, object] = Field(default_factory=dict)


class ChatCompletionRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage] = Field(default_factory=list)
    temperature: float | None = None
    max_tokens: int | None = None
    stream: bool = False
    tools: list[ChatToolDefinition] = Field(default_factory=list)
    tool_choice: str | dict[str, object] | None = None


ChartTypeName = Literal["individual", "pChart", "npChart", "cChart", "uChart", "xBarS", "xBarR", "ewma", "histogram", "scatterPlot"]


AGENT_CHART_TYPES = {
    "individual",
    "pChart",
    "npChart",
    "cChart",
    "uChart",
    "xBarS",
    "xBarR",
    "ewma",
    "histogram",
    "scatterPlot",
}


class AgentControls(BaseModel):
    chartType: ChartTypeName
    yColumns: list[str] = Field(default_factory=list)
    xAxisColumn: str | None = None
    denominatorColumn: str | None = None
    sampleSize: int = 5
    effectiveSampleSize: int | None = None
    chartLabel: str | None = None
    zAxisLabel: str | None = None
    yAxisLabel: str | None = None
    showControlLimits: bool = True
    showCenterLine: bool = True
    showRuleViolations: bool = True
    showSigma1: bool = False
    showSigma2: bool = False
    showSigma3: bool = False
    colorScheme: str | None = None


class AgentTurnRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage] = Field(default_factory=list)
    language: Literal["en", "he"] = "en"
    controls: AgentControls
    availableHeaders: list[str] = Field(default_factory=list)
    worksheet: dict[str, Any] = Field(default_factory=dict)
    dataset: dict[str, Any] = Field(default_factory=dict)
    processed: dict[str, Any] | None = None
    selectedSheetIndex: int | None = None
    temperature: float | None = None
    max_tokens: int | None = None


class AgentControlPatch(BaseModel):
    chartType: ChartTypeName | None = None
    yColumns: list[str] | None = None
    xAxisColumn: str | None = None
    denominatorColumn: str | None = None
    sampleSize: int | None = None
    chartLabel: str | None = None
    zAxisLabel: str | None = None
    yAxisLabel: str | None = None
    showControlLimits: bool | None = None
    showCenterLine: bool | None = None
    showRuleViolations: bool | None = None
    showSigma1: bool | None = None
    showSigma2: bool | None = None
    showSigma3: bool | None = None
    colorScheme: str | None = None
    applied: list[str] = Field(default_factory=list)
    skipped: list[str] = Field(default_factory=list)
    reason: str | None = None


class AgentTurnResponse(BaseModel):
    content: str
    reasoning: str | None = None
    controlPatch: dict[str, Any] | None = None
    toolTrace: list[dict[str, Any]] = Field(default_factory=list)
    knowledgeSources: list[str] = Field(default_factory=list)
    needsClarification: bool = False
    model: str = "unknown"
    usage: dict[str, int] | None = None


class ToolMetadata(BaseModel):
    name: str
    description: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    markdown: str


class KnowledgeSelection(BaseModel):
    markdown: str
    sources: list[str]


class AgentRecommendationModel(BaseModel):
    chartType: ChartTypeName | None = None
    yColumns: list[str] = Field(default_factory=list)
    yColumn: str | None = None
    xAxisColumn: str | None = None
    denominatorColumn: str | None = None
    sampleSize: int | None = None
    chartLabel: str | None = None
    zAxisLabel: str | None = None
    yAxisLabel: str | None = None
    reason: str = ""


class AgentRecommendationEnvelope(BaseModel):
    recommendation: AgentRecommendationModel = Field(default_factory=AgentRecommendationModel)


TOOL_PARAMETER_SCHEMAS: dict[str, dict[str, Any]] = {
    "list-tools": {
        "type": "object",
        "additionalProperties": False,
        "properties": {},
    },
    "read_controls": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "include": {
                "type": "array",
                "items": {"type": "string", "enum": ["current", "available", "worksheet", "assistant", "dataset", "processed", "diagnostics"]},
                "description": "Optional snapshot sections. Omit to return every section.",
            },
        },
    },
    "read_spc_diagnostics": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "include": {
                "type": "array",
                "items": {"type": "string", "enum": ["dataProfile", "diagnostics", "chartRecommendations", "capabilityStatus", "ruleViolationCount"]},
                "description": "Optional diagnostic sections. Omit to return all SPC diagnostics.",
            },
        },
    },
    "update_controls": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "chartType": {"type": ["string", "null"], "enum": [*sorted(AGENT_CHART_TYPES), None]},
            "yColumns": {"type": "array", "items": {"type": "string"}},
            "xAxisColumn": {"type": ["string", "null"]},
            "denominatorColumn": {"type": ["string", "null"]},
            "sampleSize": {"type": ["integer", "null"], "minimum": 2, "maximum": 25},
            "chartLabel": {"type": ["string", "null"]},
            "zAxisLabel": {"type": ["string", "null"]},
            "yAxisLabel": {"type": ["string", "null"]},
            "showControlLimits": {"type": "boolean"},
            "showCenterLine": {"type": "boolean"},
            "showRuleViolations": {"type": "boolean"},
            "showSigma1": {"type": "boolean"},
            "showSigma2": {"type": "boolean"},
            "showSigma3": {"type": "boolean"},
            "colorScheme": {"type": ["string", "null"]},
            "reason": {"type": ["string", "null"]},
        },
    },
}


TOOL_MARKDOWN: dict[str, str] = {
    "list-tools": """# list-tools

Purpose: Show the assistant every SPC UI tool it can use.

Use this when:
- You need to confirm available tool names before acting.
- You need the argument contract or safety rules for a tool.
- You are unsure whether to inspect controls or update them.

Inputs: none.

Returns:
- `markdown`: full human-readable tool documentation.
- `tools`: structured metadata with name, description, and JSON-style parameters.

Safety:
- This tool never changes chart settings.
- Prefer using it before complex multi-step tool plans.
""",
    "read_controls": """# read_controls

Purpose: Read current SPC chart controls, worksheet metadata, available options, and bounded dataset context.

Use this when:
- Current chart type, selected columns, labels, overlays, or sample size matter.
- You need to validate column names before calling `update_controls`.
- The request depends on worksheet or dataset context.

Inputs:
- `include`: optional list of sections: `current`, `available`, `worksheet`, `assistant`, `dataset`, `processed`, `diagnostics`.

Returns:
- A JSON object containing the selected snapshot sections.

Safety:
- This tool never changes chart settings.
- Always use active-sheet headers when choosing columns.
""",
    "read_spc_diagnostics": """# read_spc_diagnostics

Purpose: Read SPC data profile, diagnostics, chart candidates, capability readiness, and rule count.

Use this when:
- You might change chart type based on data structure.
- You need to know whether P/U denominators, count data, time order, or subgroup assumptions are valid.
- You need to explain why capability is ready, preliminary, or not applicable.

Inputs:
- `include`: optional list of sections: `dataProfile`, `diagnostics`, `chartRecommendations`, `capabilityStatus`, `ruleViolationCount`.

Returns:
- A JSON object containing the selected diagnostic sections from the current processed dataset.

Safety:
- This tool never changes chart settings.
- Read this before `update_controls` when assumptions or blockers matter.
""",
    "update_controls": """# update_controls

Purpose: Propose validated updates to the SPC UI controls.

Use this when:
- The user asks Agent Mode to apply or configure an SPC chart.
- You have enough context to choose chart type, Y columns, X axis, denominator, sample size, labels, overlays, or color scheme.
- You have checked diagnostics when changing chart families or choosing attribute/subgrouped charts.

Inputs:
- `chartType`: one of individual, pChart, npChart, cChart, uChart, xBarS, xBarR, ewma, histogram, scatterPlot.
- `yColumns`: ordered Y-axis columns from active-sheet headers.
- `xAxisColumn`: active-sheet column or null for implicit row index.
- `denominatorColumn`: active-sheet denominator/opportunities column or null.
- `sampleSize`: subgroup size, clamped to 2..25.
- `chartLabel`, `zAxisLabel`, `yAxisLabel`: optional trimmed labels.
- Overlay booleans: `showControlLimits`, `showCenterLine`, `showRuleViolations`, `showSigma1`, `showSigma2`, `showSigma3`.
- `colorScheme`: chart color scheme identifier.
- `reason`: short explanation for the update.

Validation:
- Invalid chart types and missing columns are skipped and reported.
- For X-bar R/S charts with multiple Y columns, sample size is forced to the number of Y columns.
- P/U denominator columns must exist in active-sheet headers.
- Empty labels are ignored.

Returns:
- `patch`: browser-applyable changes only.
- `applied`: successfully accepted field names.
- `skipped`: rejected or invalid field names.
- `current`: the request-local state after applying valid changes.

Safety:
- This tool mutates only request-local Python state.
- The browser remains responsible for applying the returned patch.
""",
}


class SPCKnowledgeLoader:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root or self._resolve_default_root()
        self._cache_mtime: float | None = None
        self._cache: dict[str, str] = {}

    @staticmethod
    def _resolve_default_root() -> Path:
        current_file = Path(__file__).resolve()
        return current_file.parents[2] / "docs" / "knowledge"

    def _current_mtime(self) -> float | None:
        if not self.root.is_dir():
            return None
        mtimes = [path.stat().st_mtime for path in self.root.glob("*.md") if path.is_file()]
        return max(mtimes, default=None)

    def load(self) -> dict[str, str]:
        mtime = self._current_mtime()
        if mtime == self._cache_mtime:
            return dict(self._cache)

        docs: dict[str, str] = {}
        if self.root.is_dir():
            for path in sorted(self.root.glob("*.md")):
                if path.is_file():
                    docs[path.name] = path.read_text(encoding="utf-8", errors="replace").strip()

        self._cache = docs
        self._cache_mtime = mtime
        return dict(docs)

    @staticmethod
    def _select_source_names(text: str) -> list[str]:
        lowered = text.lower()
        selected: list[str] = []

        if any(marker in lowered for marker in ("i-mr", "imr", "individual", "moving range", "subgroup size = 1")):
            selected.append("i-mr.md")
        if any(marker in lowered for marker in ("xbar-r", "x-bar r", "x bar r", "xbarr", "xBarR".lower(), "range chart")):
            selected.append("xbar-r.md")
        if any(marker in lowered for marker in ("xbar-s", "x-bar s", "x bar s", "xbars", "xBarS".lower(), "s chart", "standard deviation")):
            selected.append("xbar-s.md")
        if any(marker in lowered for marker in ("p chart", "np chart", "c chart", "u chart", "attribute", "defect", "defective", "denominator", "opportunities")):
            selected.append("attribute-charts.md")
        if any(marker in lowered for marker in ("capability", "cpk", "ppk", "specification", "lsl", "usl", "cpm")):
            selected.append("capability-performance.md")
        if any(marker in lowered for marker in ("chart selection", "choose chart", "recommendation", "data profile", "diagnostic")):
            selected.append("chart-selection.md")
        if any(marker in lowered for marker in ("gage", "gauge", "msa", "measurement system", "resolution")):
            selected.append("measurement-system.md")
        if any(marker in lowered for marker in ("semiconductor", "wafer", "fab", "metrology", "reticle", "die")):
            selected.append("semiconductor-playbook.md")
        if any(marker in lowered for marker in ("aiag", "automotive", "apqp", "ppap", "control plan", "iatf")):
            selected.append("automotive-core-tools.md")
        if any(marker in lowered for marker in ("pharma", "cpv", "pat", "cqa", "cpp", "continued process verification")):
            selected.append("pharma-cpv-pat.md")

        return selected

    def select(self, request: AgentTurnRequest) -> KnowledgeSelection:
        docs = self.load()
        text_parts = [
            request.controls.chartType,
            json.dumps(request.controls.model_dump(), ensure_ascii=False),
            json.dumps(request.dataset, ensure_ascii=False),
            "\n".join((message.content or "") for message in request.messages[-8:]),
        ]
        selected_names = [name for name in self._select_source_names("\n".join(text_parts)) if name in docs]

        if not selected_names:
            selected_names = list(docs.keys())

        markdown_parts = [f"<!-- source: {name} -->\n{docs[name]}" for name in selected_names]
        return KnowledgeSelection(markdown="\n\n".join(markdown_parts), sources=selected_names)


class SPCAgentDecision(dspy.Signature):
    """Use SPC knowledge and tools to answer the user and optionally produce validated UI changes.

    Rules:
    - Use list-tools when available tool capabilities are unclear.
    - Use read_controls before update_controls when current state, headers, or worksheet context matter.
    - Use read_spc_diagnostics before update_controls when changing chart families, using attribute charts, or discussing capability.
    - Use update_controls for UI changes instead of writing recommendation JSON.
    - Do not apply P/U charts without a valid denominator or valid proportion/rate context.
    - Do not imply capability is ready unless capabilityStatus says ready.
    - Keep the final answer short, direct, and user-facing.
    - Ask at most two concise clarifying questions when required information is missing.
    """

    language = dspy.InputField(desc="Language code: en or he")
    context = dspy.InputField(desc="Recent chat history and dataset context")
    user_request = dspy.InputField(desc="Latest user request")
    controls = dspy.InputField(desc="Current SPC UI control state as JSON")
    spc_knowledge = dspy.InputField(desc="Relevant SPC Markdown knowledge from docs/knowledge")
    tool_docs = dspy.InputField(desc="Markdown documentation for available tools")
    answer = dspy.OutputField(desc="Short user-facing answer")
    needs_clarification = dspy.OutputField(desc="true if more user input is needed, otherwise false")


class SPCAgentToolSession:
    def __init__(self, request: AgentTurnRequest, tool_metadata: list[ToolMetadata]) -> None:
        self.request = request
        self.tool_metadata = tool_metadata
        self.current: dict[str, Any] = request.controls.model_dump()
        self.patch: dict[str, Any] = {}
        self.applied: list[str] = []
        self.skipped: list[str] = []
        self.trace: list[dict[str, Any]] = []

    @staticmethod
    def _clean_text(value: Any) -> str | None:
        if not isinstance(value, str):
            return None
        trimmed = value.strip()
        return trimmed or None

    @staticmethod
    def _clamp_sample_size(value: Any) -> int | None:
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
    def _unique_strings(values: Any) -> list[str]:
        if not isinstance(values, list):
            return []
        selected: list[str] = []
        for value in values:
            if not isinstance(value, str):
                continue
            trimmed = value.strip()
            if trimmed and trimmed not in selected:
                selected.append(trimmed)
        return selected

    def _record(self, name: str, args: dict[str, Any], result: dict[str, Any]) -> str:
        compact = dict(result)
        if name == "list-tools" and "markdown" in compact:
            compact["markdown"] = "[tool markdown omitted from trace]"
        self.trace.append({"tool": name, "args": args, "result": compact})
        return json.dumps(result, ensure_ascii=False)

    def _snapshot(self) -> dict[str, Any]:
        headers = self.request.availableHeaders
        current = dict(self.current)
        sample_size = self._clamp_sample_size(current.get("sampleSize")) or 5
        selected_columns = self._unique_strings(current.get("yColumns"))
        effective_sample_size = len(selected_columns) if current.get("chartType") in {"xBarS", "xBarR"} and len(selected_columns) > 1 else sample_size
        current["sampleSize"] = sample_size
        current["effectiveSampleSize"] = effective_sample_size

        return {
            "current": current,
            "available": {
                "chartTypes": sorted(AGENT_CHART_TYPES),
                "headers": headers,
                "sampleSize": {
                    "min": 2,
                    "max": 25,
                    "current": sample_size,
                    "effective": effective_sample_size,
                    "lockedToYColumns": current.get("chartType") in {"xBarS", "xBarR"} and len(selected_columns) > 1,
                },
                "editableFields": [
                    "chartType",
                    "yColumns",
                    "xAxisColumn",
                    "denominatorColumn",
                    "sampleSize",
                    "chartLabel",
                    "zAxisLabel",
                    "yAxisLabel",
                    "showControlLimits",
                    "showCenterLine",
                    "showRuleViolations",
                    "showSigma1",
                    "showSigma2",
                    "showSigma3",
                    "colorScheme",
                ],
            },
            "worksheet": self.request.worksheet,
            "assistant": {
                "language": self.request.language,
                "agentModeEnabled": True,
                "tools": [tool.name for tool in self.tool_metadata],
            },
            "dataset": self.request.dataset,
            "processed": self.request.processed,
            "diagnostics": self._diagnostics(),
        }

    def _diagnostics(self) -> dict[str, Any]:
        processed = self.request.processed or {}
        return {
            "dataProfile": processed.get("dataProfile"),
            "diagnostics": processed.get("diagnostics") or [],
            "chartRecommendations": processed.get("chartRecommendations") or [],
            "capabilityStatus": processed.get("capabilityStatus"),
            "ruleViolationCount": processed.get("ruleViolationCount", 0),
        }

    def list_tools(self) -> str:
        result = {
            "ok": True,
            "tool": "list-tools",
            "markdown": "\n\n".join(tool.markdown for tool in self.tool_metadata),
            "tools": [tool.model_dump() for tool in self.tool_metadata],
        }
        return self._record("list-tools", {}, result)

    def read_controls(self, include: list[str] | None = None) -> str:
        snapshot = self._snapshot()
        selected = snapshot
        if include:
            allowed = {key for key in include if key in snapshot}
            selected = {key: snapshot[key] for key in allowed}
        result = {"ok": True, "tool": "read_controls", "snapshot": selected}
        return self._record("read_controls", {"include": include}, result)

    def read_spc_diagnostics(self, include: list[str] | None = None) -> str:
        diagnostics = self._diagnostics()
        selected = diagnostics
        if include:
            allowed = {key for key in include if key in diagnostics}
            selected = {key: diagnostics[key] for key in allowed}
        result = {"ok": True, "tool": "read_spc_diagnostics", "diagnostics": selected}
        return self._record("read_spc_diagnostics", {"include": include}, result)

    def update_controls(self, **kwargs: Any) -> str:
        headers = set(self.request.availableHeaders)
        applied: list[str] = []
        skipped: list[str] = []

        chart_type = kwargs.get("chartType")
        if "chartType" in kwargs:
            if isinstance(chart_type, str) and chart_type in AGENT_CHART_TYPES:
                self.current["chartType"] = chart_type
                self.patch["chartType"] = chart_type
                applied.append("chartType")
            elif chart_type is not None:
                skipped.append("chartType")

        if "yColumns" in kwargs:
            requested_columns = self._unique_strings(kwargs.get("yColumns"))
            valid_columns = [column for column in requested_columns if column in headers]
            if valid_columns or not requested_columns:
                self.current["yColumns"] = valid_columns
                self.patch["yColumns"] = valid_columns
                applied.append("yColumns")
            else:
                skipped.append("yColumns")

        if "xAxisColumn" in kwargs:
            x_axis = kwargs.get("xAxisColumn")
            if x_axis is None:
                self.current["xAxisColumn"] = None
                self.patch["xAxisColumn"] = None
                applied.append("xAxisColumn")
            elif isinstance(x_axis, str) and x_axis in headers:
                self.current["xAxisColumn"] = x_axis
                self.patch["xAxisColumn"] = x_axis
                applied.append("xAxisColumn")
            else:
                skipped.append("xAxisColumn")

        if "denominatorColumn" in kwargs:
            denominator = kwargs.get("denominatorColumn")
            if denominator is None:
                self.current["denominatorColumn"] = None
                self.patch["denominatorColumn"] = None
                applied.append("denominatorColumn")
            elif isinstance(denominator, str) and denominator in headers:
                self.current["denominatorColumn"] = denominator
                self.patch["denominatorColumn"] = denominator
                applied.append("denominatorColumn")
            else:
                skipped.append("denominatorColumn")

        profile = self._diagnostics().get("dataProfile") or {}
        data_kind = profile.get("dataKind") if isinstance(profile, dict) else None
        proposed_chart = self.current.get("chartType")
        if (
            proposed_chart == "pChart"
            and not self.current.get("denominatorColumn")
            and data_kind not in {"proportion", "binary"}
        ):
            self.current["chartType"] = self.request.controls.chartType
            self.patch.pop("chartType", None)
            applied = [item for item in applied if item != "chartType"]
            skipped.append("chartType")
        if proposed_chart in {"npChart", "cChart", "uChart"} and data_kind not in {"count", "binary"}:
            self.current["chartType"] = self.request.controls.chartType
            self.patch.pop("chartType", None)
            applied = [item for item in applied if item != "chartType"]
            skipped.append("chartType")

        selected_columns = self._unique_strings(self.current.get("yColumns"))
        is_xbar = self.current.get("chartType") in {"xBarS", "xBarR"}
        forced_sample_size = len(selected_columns) if is_xbar and len(selected_columns) > 1 else None
        if forced_sample_size is not None:
            self.current["sampleSize"] = forced_sample_size
            self.patch["sampleSize"] = forced_sample_size
            applied.append("sampleSize")
        elif "sampleSize" in kwargs:
            sample_size = self._clamp_sample_size(kwargs.get("sampleSize"))
            if sample_size is not None:
                self.current["sampleSize"] = sample_size
                self.patch["sampleSize"] = sample_size
                applied.append("sampleSize")
            elif kwargs.get("sampleSize") is not None:
                skipped.append("sampleSize")

        text_fields = {
            "chartLabel": "chartLabel",
            "zAxisLabel": "zAxisLabel",
            "yAxisLabel": "yAxisLabel",
            "colorScheme": "colorScheme",
        }
        for input_name, field_name in text_fields.items():
            if input_name not in kwargs:
                continue
            cleaned = self._clean_text(kwargs.get(input_name))
            if cleaned is None:
                if kwargs.get(input_name) is not None:
                    skipped.append(field_name)
                continue
            self.current[field_name] = cleaned
            self.patch[field_name] = cleaned
            applied.append(field_name)

        bool_fields = (
            "showControlLimits",
            "showCenterLine",
            "showRuleViolations",
            "showSigma1",
            "showSigma2",
            "showSigma3",
        )
        for field_name in bool_fields:
            if field_name not in kwargs:
                continue
            value = kwargs.get(field_name)
            if isinstance(value, bool):
                self.current[field_name] = value
                self.patch[field_name] = value
                applied.append(field_name)
            else:
                skipped.append(field_name)

        reason = self._clean_text(kwargs.get("reason"))
        if reason:
            self.patch["reason"] = reason

        self.applied.extend(applied)
        self.skipped.extend(skipped)
        if self.patch:
            self.patch["applied"] = list(dict.fromkeys(self.applied))
            self.patch["skipped"] = list(dict.fromkeys(self.skipped))

        result = {
            "ok": True,
            "tool": "update_controls",
            "patch": self.patch,
            "applied": applied,
            "skipped": skipped,
            "current": self._snapshot()["current"],
            "reason": reason,
        }
        return self._record("update_controls", kwargs, result)

    def dspy_tools(self) -> list[dspy.Tool]:
        return [
            dspy.Tool(
                self.list_tools,
                name="list-tools",
                desc=self.tool_metadata[0].description,
                args=TOOL_PARAMETER_SCHEMAS["list-tools"]["properties"],
            ),
            dspy.Tool(
                self.read_controls,
                name="read_controls",
                desc=self.tool_metadata[1].description,
                args=TOOL_PARAMETER_SCHEMAS["read_controls"]["properties"],
            ),
            dspy.Tool(
                self.read_spc_diagnostics,
                name="read_spc_diagnostics",
                desc=self.tool_metadata[2].description,
                args=TOOL_PARAMETER_SCHEMAS["read_spc_diagnostics"]["properties"],
            ),
            dspy.Tool(
                self.update_controls,
                name="update_controls",
                desc=self.tool_metadata[3].description,
                args=TOOL_PARAMETER_SCHEMAS["update_controls"]["properties"],
            ),
        ]


class SPCAgentHarness:
    def __init__(self, max_iters: int = 6) -> None:
        self.max_iters = max_iters
        self.tool_metadata = [
            ToolMetadata(
                name="list-tools",
                description="List available SPC agent tools with Markdown instructions and structured schemas.",
                parameters=TOOL_PARAMETER_SCHEMAS["list-tools"],
                markdown=TOOL_MARKDOWN["list-tools"],
            ),
            ToolMetadata(
                name="read_controls",
                description="Read current SPC controls, worksheet context, assistant settings, and allowed options.",
                parameters=TOOL_PARAMETER_SCHEMAS["read_controls"],
                markdown=TOOL_MARKDOWN["read_controls"],
            ),
            ToolMetadata(
                name="read_spc_diagnostics",
                description="Read SPC diagnostics, chart candidates, capability readiness, and blockers.",
                parameters=TOOL_PARAMETER_SCHEMAS["read_spc_diagnostics"],
                markdown=TOOL_MARKDOWN["read_spc_diagnostics"],
            ),
            ToolMetadata(
                name="update_controls",
                description="Validate and propose SPC UI control changes as a browser-applyable patch.",
                parameters=TOOL_PARAMETER_SCHEMAS["update_controls"],
                markdown=TOOL_MARKDOWN["update_controls"],
            ),
        ]

    @staticmethod
    def _latest_user_request(messages: list[ChatMessage]) -> str:
        for message in reversed(messages):
            if message.role == "user" and (message.content or "").strip():
                return (message.content or "").strip()
        return ""

    @staticmethod
    def _message_context(messages: list[ChatMessage], dataset: dict[str, Any], processed: dict[str, Any] | None) -> str:
        fragments: list[str] = []
        for message in messages[-12:]:
            content = (message.content or "").strip()
            if not content:
                continue
            fragments.append(f"{message.role}: {content}")
        if dataset:
            fragments.append(f"dataset: {json.dumps(dataset, ensure_ascii=False)}")
        if processed:
            fragments.append(f"processed: {json.dumps(processed, ensure_ascii=False)}")
        return "\n".join(fragments)

    @staticmethod
    def _parse_bool(value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "yes", "y"}
        return False

    def run(self, request: AgentTurnRequest, knowledge: KnowledgeSelection, model_name: str) -> AgentTurnResponse:
        session = SPCAgentToolSession(request, self.tool_metadata)
        agent = dspy.ReAct(SPCAgentDecision, tools=session.dspy_tools(), max_iters=self.max_iters)
        user_request = self._latest_user_request(request.messages)
        if not user_request:
            return AgentTurnResponse(
                content="- Please ask one specific SPC question.",
                controlPatch=None,
                toolTrace=[],
                knowledgeSources=knowledge.sources,
                needsClarification=True,
                model=model_name,
                usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            )

        prediction = agent(
            language=request.language,
            context=self._message_context(request.messages, request.dataset, request.processed),
            user_request=user_request,
            controls=json.dumps(request.controls.model_dump(), ensure_ascii=False),
            spc_knowledge=knowledge.markdown,
            tool_docs="\n\n".join(tool.markdown for tool in self.tool_metadata),
        )

        content = str(getattr(prediction, "answer", "")).strip() or "- No recommendation generated."
        reasoning = None
        trajectory = getattr(prediction, "trajectory", None)
        if isinstance(trajectory, dict):
            thoughts = [str(value).strip() for key, value in trajectory.items() if key.startswith("thought_") and str(value).strip()]
            reasoning = "\n".join(thoughts) or None

        return AgentTurnResponse(
            content=content,
            reasoning=reasoning,
            controlPatch=session.patch or None,
            toolTrace=session.trace,
            knowledgeSources=knowledge.sources,
            needsClarification=self._parse_bool(getattr(prediction, "needs_clarification", False)),
            model=model_name,
            usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        )


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
        denominator_value = recommendation_data.get("denominatorColumn")
        denominator_column = cls._clean_optional_text(denominator_value)
        chart_label = cls._clean_optional_text(recommendation_data.get("chartLabel"))
        z_axis_label = cls._clean_optional_text(recommendation_data.get("zAxisLabel") or recommendation_data.get("xAxisLabel"))
        y_axis_label = cls._clean_optional_text(recommendation_data.get("yAxisLabel"))
        reason = cls._clean_optional_text(recommendation_data.get("reason")) or ""

        return AgentRecommendationModel(
            chartType=chart_type,  # type: ignore[arg-type]
            yColumns=y_columns,
            yColumn=y_columns[0] if y_columns else y_column_legacy,
            xAxisColumn=x_axis_column,
            denominatorColumn=denominator_column,
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
        if model.denominatorColumn is not None:
            score += 2
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
    def _recover_chart_type(content: str) -> ChartTypeName | None:
        lowered = content.lower()
        chart_patterns: list[tuple[str, ChartTypeName]] = [
            (r"\bx\s*[- ]?\s*bar\s*s\b|\bxbar\s*s\b|\bx-bar\s*s\b", "xBarS"),
            (r"\bx\s*[- ]?\s*bar\s*r\b|\bxbar\s*r\b|\bx-bar\s*r\b", "xBarR"),
            (r"\bi\s*[- ]?\s*mr\b|\bindividual\b|\bi chart\b", "individual"),
            (r"\bu\s*chart\b|\bu-chart\b|defects per unit", "uChart"),
            (r"\bc\s*chart\b|\bc-chart\b|defect count", "cChart"),
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
            denominatorColumn=None,
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
        self._agent_harness: SPCAgentHarness | None = None
        self._knowledge_loader = SPCKnowledgeLoader()
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
        self._agent_harness = None
        self._active_config = None
        self._model_name = None
        self._api_base = None

    def _configure(self) -> None:
        model_name, api_base, current_config, litellm_model_name, lm_kwargs = self._resolve_litellm_runtime()
        if self._predictor is not None and self._active_config == current_config:
            return

        lm = dspy.LM(litellm_model_name, **lm_kwargs)
        dspy.configure(lm=lm)
        self._predictor = dspy.Predict(SPCConciseAdvice)
        self._agent_harness = SPCAgentHarness()
        self._model_name = model_name
        self._api_base = api_base
        self._active_config = current_config

    def _resolve_litellm_runtime(self) -> tuple[str, str | None, tuple[str, str | None, str, str | None], str, dict[str, object]]:
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
        return model_name, api_base, current_config, litellm_model_name, lm_kwargs

    @staticmethod
    def _serialize_chat_message(message: ChatMessage) -> dict[str, object]:
        serialized: dict[str, object] = {
            "role": message.role,
            "content": message.content or "",
        }
        if message.tool_call_id:
            serialized["tool_call_id"] = message.tool_call_id
        if message.tool_calls:
            serialized["tool_calls"] = message.tool_calls
        return serialized

    @staticmethod
    def _normalize_completion_response(response: object) -> dict[str, object]:
        if isinstance(response, dict):
            return response
        if hasattr(response, "model_dump"):
            dumped = response.model_dump()
            if isinstance(dumped, dict):
                return dumped
        if hasattr(response, "dict"):
            dumped = response.dict()
            if isinstance(dumped, dict):
                return dumped
        raise RuntimeError("LiteLLM returned an unsupported completion payload")

    def complete_with_tools(self, payload: ChatCompletionRequest) -> dict[str, object]:
        _, api_base, current_config, litellm_model_name, completion_kwargs = self._resolve_litellm_runtime()
        model_name = current_config[0]
        self._model_name = model_name
        self._api_base = api_base
        self._active_config = current_config

        if payload.temperature is not None:
            completion_kwargs["temperature"] = payload.temperature
        if payload.max_tokens is not None:
            completion_kwargs["max_tokens"] = payload.max_tokens

        completion_kwargs.update({
            "model": litellm_model_name,
            "messages": [self._serialize_chat_message(message) for message in payload.messages],
            "stream": False,
        })
        if payload.tools:
            completion_kwargs["tools"] = [tool.model_dump(exclude_none=True) for tool in payload.tools]
        if payload.tool_choice is not None:
            completion_kwargs["tool_choice"] = payload.tool_choice

        response = litellm.completion(**completion_kwargs)
        return self._normalize_completion_response(response)

    def agent_turn(self, payload: AgentTurnRequest) -> dict[str, object]:
        self._configure()
        if self._agent_harness is None:
            raise RuntimeError("DSPy agent harness is not configured")

        knowledge = self._knowledge_loader.select(payload)
        model_name = env_first("AI_MODEL", "VITE_AI_MODEL") or self._model_name or "unknown"
        response = self._agent_harness.run(payload, knowledge, model_name)
        return response.model_dump()

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


@app.get("/healthz")
def healthz() -> dict[str, str]:
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


@app.post("/v1/agent/turn")
def agent_turn(
    payload: AgentTurnRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    required_gateway_key = env_first("AI_GATEWAY_API_KEY", "DSPY_GATEWAY_API_KEY") or DEFAULT_GATEWAY_API_KEY
    if required_gateway_key:
        token = ""
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()
        if token != required_gateway_key:
            raise HTTPException(status_code=401, detail="Invalid API key")

    try:
        return gateway.agent_turn(payload)
    except Exception as exc:  # pragma: no cover
        detail = str(exc) or "DSPy agent inference failed"
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
                    "DSPy upstream provider rate limited this agent request. "
                    f"model={model_name}, api_base={safe_base}. "
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
                    "DSPy upstream connection failed during agent request. "
                    f"model={model_name}, api_base={safe_base}. "
                    f"Original error: {detail}"
                ),
            ) from exc
        raise HTTPException(status_code=500, detail=f"DSPy agent inference failed: {detail}") from exc


@app.post("/v1/chat/completions")
def chat_completions(
    payload: ChatCompletionRequest,
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    required_gateway_key = env_first("AI_GATEWAY_API_KEY", "DSPY_GATEWAY_API_KEY") or DEFAULT_GATEWAY_API_KEY
    if required_gateway_key:
        token = ""
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()
        if token != required_gateway_key:
            raise HTTPException(status_code=401, detail="Invalid API key")

    tool_enabled_request = bool(payload.tools) or any(message.role == "tool" or message.tool_calls for message in payload.messages)

    try:
        if tool_enabled_request:
            if payload.stream:
                raise HTTPException(status_code=400, detail="Tool-enabled requests currently require stream=false")
            return gateway.complete_with_tools(payload)

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


@app.get("/config/runtime-config.js", include_in_schema=False)
def serve_runtime_config() -> Response:
    return runtime_config_response()


@app.get("/", include_in_schema=False)
def serve_frontend_root() -> FileResponse:
    return frontend_index_response()


@app.get("/{asset_path:path}", include_in_schema=False)
def serve_frontend_asset(asset_path: str) -> FileResponse:
    reserved_prefixes = ("v1/", "health", "docs", "openapi.json", "redoc")
    if asset_path.startswith(reserved_prefixes):
        raise HTTPException(status_code=404, detail="Not found")

    asset_response = frontend_file_response(asset_path)
    if asset_response is not None:
        return asset_response

    if "." in Path(asset_path).name:
        raise HTTPException(status_code=404, detail="Static asset not found")

    return frontend_index_response()


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
