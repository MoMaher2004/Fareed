from llms.Openrouter import Openrouter
from datetime import time

class Dolphin24b(Openrouter):
    efforts = ["none"]
    name = "cognitivecomputations/dolphin-mistral-24b-venice-edition"
    costs = {
        "inputCashHit_offPeak": 0.2,
        "inputCashHit_peak": 0.2,
        "inputCashMiss_offPeak": 0.2,
        "inputCashMiss_peak": 0.2,
        "output_offPeak": 0.9,
        "output_peak": 0.9,
    }
    peak_intervals = []
    contextWindow = 128_000
    maxOutputTokens = None
    supportsVision = False
    reasoningMode = False
    tool_usage = False