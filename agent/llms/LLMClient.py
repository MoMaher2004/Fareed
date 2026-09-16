from llms.DeepseekV4Flash import DeepseekV4Flash
from llms.DeepseekV4Pro import DeepseekV4Pro

class LLMClient:
    models = {DeepseekV4Flash.name: DeepseekV4Flash, DeepseekV4Pro.name: DeepseekV4Pro}

    def __init__(self, model_name: str):
        if model_name not in self.models:
            raise ValueError(f"Model '{model_name}' is not supported.")
        self.model = self.models[model_name]()

    def stream(self, history: list, tools_schema: list):
        return self.model.stream(history, tools_schema)

    def chat(self, history: list, tools_schema: list):
        return self.model.chat(history, tools_schema)