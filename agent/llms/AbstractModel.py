from abc import ABC, abstractmethod
from openai import OpenAI
from tools import Tool
import traceback
import json


class AbstractModel(ABC):
    url: str = None
    apiKey: str = None
    efforts: list = None
    name: str = None
    costs: dict = None
    contextWindow: int = None
    maxOutputTokens: int = None
    supportsVision: bool = None
    reasoningModel: bool = None
    coding_score: float = None
    reasoning_score: float = None
    tool_call_score: float = None
    speed_score: float = None

    @abstractmethod
    def mapFinishReason(reason):
        pass



    @classmethod
    async def stream(cls, history):
        try:
            toolsSchema = [
                {
        "type": "function",
        "function": {
            "name": "tools_pack",
            "description": (
                "Returns a list of available tools and their descriptions "
                "so that you can use extra tools according to your needs."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "packs": {
                        "description": (
                            "The name of the tool pack to use. "
                            "You can choose from the following options: "
                            "'python' for python execution tools, "
                            "'ssh' for SSH tools, "
                            "'cronjob' to manage cron jobs, "
                            "'updater' for tools you can use to understand "
                            "your architecture and suggest updates, "
                            "'time' to get time information, "
                            "'bye' to end the session, "
                            "'search' for search tools."
                        ),
                        "type": "array",
                        "items": {
                            "type": "string"
                        }
                    }
                },
                "required": ["packs"]
            }
        }
    }
            ]
            while True:
                content = []
                reasoning = []
                tool_calls = []
                tool = None
                print(f"Streaming with model: {cls.name} and API key: {cls.apiKey}")
                for r in OpenAI(api_key=cls.apiKey, base_url=cls.url).chat.completions.create(
                    model=cls.name,
                    messages=history,
                    tools=toolsSchema,
                    stream=True
                ):
                    if getattr(
                        r.choices[0],
                        cls.mapFinishReason("finish_reason")
                    ) == cls.mapFinishReason("stop"):
                        if len(tool_calls) > 0:
                            for tc in tool_calls:
                                tc['arguments'] = json.loads(''.join(tc['arguments']))
                            yield {'type': 'tool_calls', 'tool_calls': tool_calls}
                        else:
                            yield {'type': 'end'}
                        return
                    elif r.choices[0].delta.tool_calls != None:
                        if r.choices[0].delta.tool_calls[0].function.name:
                            tool = {
                                'name': r.choices[0].delta.tool_calls[0].function.name,
                                'arguments': [],
                                'id': r.choices[0].delta.tool_calls[0].id,
                                'type': r.choices[0].delta.tool_calls[0].type
                            }
                            tool_calls.append(tool)
                        else:
                            tool['arguments'].append(r.choices[0].delta.tool_calls[0].function.arguments)
                    elif r.choices[0].delta.content != None:
                        yield {'type': 'message', 'content': r.choices[0].delta.content}
                        content.append(r.choices[0].delta.content)
                    elif r.choices[0].delta.reasoning_content != None:
                        reasoning.append(r.choices[0].delta.reasoning_content)
                        yield {'type': 'reasoning', 'content': r.choices[0].delta.reasoning_content}
                    else:
                        yield {'type': 'error', 'content': 'Unknown chunk type'}

                for tc in tool_calls:
                    tool_name = tc['name']
                    tool_args = json.loads(''.join(tc['arguments']))
                    result = await request_tool(cls.name, tc['id'], tool_name, tool_args)
                    yield result

        except Exception as e:
            print(traceback.format_exc())
            yield {'type': 'error', 'content': "internal error: " + str(e)}
