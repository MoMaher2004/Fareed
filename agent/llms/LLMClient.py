from llms.DeepseekV4Flash import DeepseekV4Flash
from llms.DeepseekV4Pro import DeepseekV4Pro
from llms.GptLuna import GptLuna
from llms.Dolphin24b import Dolphin24b

class LLMClient:
    models = {DeepseekV4Flash.name: DeepseekV4Flash, DeepseekV4Pro.name: DeepseekV4Pro, GptLuna.name: GptLuna, Dolphin24b.name: Dolphin24b}

    def __init__(self, model_name: str, reasoning_effort: str = None):
        if model_name not in self.models:
            raise ValueError(f"Model '{model_name}' is not supported.")
        self.model = self.models[model_name]()
        self.current_effort = reasoning_effort

    def stream(self, history: list, tools_schema: list):
        return self.model.stream(history, tools_schema, effort = self.current_effort)

    def chat(self, history: list, tools_schema: list):
        return self.model.chat(history, tools_schema, effort = self.current_effort)