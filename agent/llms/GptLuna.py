from llms.Openai import Openai
from datetime import time

class GptLuna(Openai):
    efforts = ["none"]
    # efforts = ["low", "high", "max"]
    name = "gpt-5.6-luna"
    costs = {
        "inputCashHit_offPeak": 0.02,
        "inputCashHit_peak": 0.02,
        "inputCashMiss_offPeak": 0.2,
        "inputCashMiss_peak": 0.2,
        "output_offPeak": 1.2,
        "output_peak": 1.2,
    }
    peak_intervals = []
    contextWindow = 1_050_000
    maxOutputTokens = 128_000
    supportsVision = True
    reasoningMode = True