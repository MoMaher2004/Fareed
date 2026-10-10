from llms.DeepseekV4Flash import DeepseekV4Flash
from llms.DeepseekV4Pro import DeepseekV4Pro
from llms.GptLuna import GptLuna
from llms.Dolphin24b import Dolphin24b

class LLMClient:
    added_models = [(DeepseekV4Flash, False), (DeepseekV4Pro, False), (GptLuna, True), (Dolphin24b, True)] # (model, is_enabled)

    models = {m[0].name: m[0] for m in added_models if m[1]}

    def __init__(self, model_name: str, reasoning_effort: str = 'none'):
        if model_name not in self.models:
            raise ValueError(f"Model '{model_name}' is not supported.")
        self.model = self.models[model_name]()
        self.current_effort = reasoning_effort

    def stream(self, history: list, tools_schema: list):
        return self.model.stream(history, tools_schema, effort = self.current_effort)

    async def stop_stream(self):
        return await self.model.stop_stream()

    def chat(self, history: list, tools_schema: list):
        return self.model.chat(history, tools_schema, effort = self.current_effort)