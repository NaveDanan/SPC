import json
import re
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from main import AgentRecommendationHarness, DSPyGateway


class AgentRecommendationHarnessTest(unittest.TestCase):
    def test_recovers_xbar_s_recommendation_from_messy_answer(self) -> None:
        answer = """Switch to X-bar S chart to utilize all five available measurement columns per subgroup.
Use all five columns (Sample_1 through Sample_5) as Y-columns for accurate subgroup statistics.
The X-bar S chart provides superior sensitivity for detecting process shifts compared to Individual charts.
Ensure all five samples are collected under consistent conditions to maintain subgroup integrity.
{
  "recommendation": {
    "chartType": "xBarS",
    "yColumns": ["Sample_1", "Sample_2", "Sample_3", "Sample_4", "Sample_5"],
    "yColumn": null,
    "xAxisColumn": null,
    "sampleSize": 5,
    "chartLabel": "X-bar and S Control Chart",
    "zAxisLabel": "Subgroup Index",
    "yAxisLabel": "Measurement Value",
    "reason": "Utilizes all 5 available columns as subgroups

json
{"recommendation": {"chartType": null, "yColumns": [], "yColumn": null, "xAxisColumn": null, "sampleSize": null, "chartLabel": null, "zAxisLabel": null, "yAxisLabel": null, "reason": ""}}
"""

        envelope = AgentRecommendationHarness.build_envelope(answer)
        recommendation = envelope.recommendation

        self.assertEqual(recommendation.chartType, "xBarS")
        self.assertEqual(
            recommendation.yColumns,
            ["Sample_1", "Sample_2", "Sample_3", "Sample_4", "Sample_5"],
        )
        self.assertEqual(recommendation.sampleSize, 5)
        self.assertEqual(recommendation.chartLabel, "X-bar and S Control Chart")
        self.assertEqual(recommendation.zAxisLabel, "Subgroup Index")
        self.assertEqual(recommendation.yAxisLabel, "Measurement Value")

    def test_gateway_appends_one_final_json_block(self) -> None:
        response = DSPyGateway()._ensure_agent_mode_response(
            """- Use all five columns (Sample_1 through Sample_5).

```json
{"recommendation":{"chartType":null,"yColumns":[],"sampleSize":null,"reason":""}}
```

{"recommendation":{"chartType":"xBarS","yColumns":["Sample_1","Sample_2","Sample_3","Sample_4","Sample_5"],"sampleSize":5,"reason":"subgroups"}}
"""
        )

        blocks = re.findall(r"```json\s*([\s\S]*?)```", response, flags=re.IGNORECASE)

        self.assertEqual(len(blocks), 1)
        payload = json.loads(blocks[0])
        self.assertEqual(payload["recommendation"]["chartType"], "xBarS")
        self.assertEqual(payload["recommendation"]["sampleSize"], 5)
        self.assertNotIn('{"recommendation"', response[: response.rfind("```json")])

    def test_gateway_strips_malformed_recommendation_tail_from_visible_narrative(self) -> None:
        response = DSPyGateway()._ensure_agent_mode_response(
            """* Switch to X-bar R chart.

{
  "recommendation": {
    "chartType": "xBarR",
    "yColumns": ["Sample_1", "Sample_2"],
    "reason": "Subgroup

json
{"recommendation":{"chartType":"xBarR","yColumns":["Sample_1","Sample_2"],"sampleSize":2,"reason":"hidden"}}
"""
        )

        narrative = response[: response.rfind("```json")].strip()
        self.assertEqual(narrative, "* Switch to X-bar R chart.")
        self.assertNotIn("recommendation", narrative)


class DSPyGatewayProviderResolutionTest(unittest.TestCase):
    def test_routes_google_openai_compat_base_to_native_gemini_provider(self) -> None:
        with patch.dict("os.environ", {"AI_PROVIDER": ""}):
            model, provider, api_base = DSPyGateway._resolve_litellm_target(
                "gemini-3.1-flash-lite-preview",
                "https://generativelanguage.googleapis.com/v1beta/openai",
            )

        self.assertEqual(model, "gemini/gemini-3.1-flash-lite-preview")
        self.assertIsNone(provider)
        self.assertIsNone(api_base)

    def test_keeps_custom_openai_compatible_base_as_openai_provider(self) -> None:
        with patch.dict("os.environ", {"AI_PROVIDER": ""}):
            model, provider, api_base = DSPyGateway._resolve_litellm_target(
                "local-model",
                "http://localhost:11434/v1",
            )

        self.assertEqual(model, "local-model")
        self.assertEqual(provider, "openai")
        self.assertEqual(api_base, "http://localhost:11434/v1")


if __name__ == "__main__":
    unittest.main()
