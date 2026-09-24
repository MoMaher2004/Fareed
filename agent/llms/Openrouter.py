from llms.AbstractModel import AbstractModel
import os

class Openrouter(AbstractModel):
    url = "https://openrouter.ai/api/v1"
    apiKey = os.getenv("OPENROUTER_API_KEY")

    def mapFinishReason(reason):
        reasonsMap = {
            "finish_reason": "finish_reason",
            "stop": "stop",
            "length": "length",
            "content_filter": "content_filter",
            "tool_calls": "tool_calls"
        }
        if reason in reasonsMap:
            return reasonsMap[reason]
        return "unknown"