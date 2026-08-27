from llms.DeepseekV4Flash import DeepseekV4Flash

class LLMClient:
    models = {DeepseekV4Flash.name: DeepseekV4Flash}

    def __init__(self, model_name: str):
        if model_name not in self.models:
            raise ValueError(f"Model '{model_name}' is not supported.")
        self.model = self.models[model_name]()

    def stream(self, history: list):
        return self.model.stream(history)