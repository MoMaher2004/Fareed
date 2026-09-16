from llms.Deepseek import Deepseek
from datetime import time

class DeepseekV4Pro(Deepseek):
    efforts = ["low", "high", "max"]
    name = "deepseek-v4-pro"
    costs = {
        "inputCashHit_offPeak": 0.022,
        "inputCashHit_peak": 0.044,
        "inputCashMiss_offPeak": 0.66,
        "inputCashMiss_peak": 1.32,
        "output_offPeak": 1.98,
        "output_peak": 3.96,
    }
    peak_intervals = [(time(1, 0), time(4, 0)), (time(6, 0), time(10, 0))]
    contextWindow = 1_000_000
    maxOutputTokens = 384_000
    supportsVision = False
    reasoningMode = True