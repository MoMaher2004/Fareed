from abc import ABC, abstractmethod
from openai import OpenAI
from tools.Tool import Tool
import traceback
import json
from termcolor import cprint


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
    def formate_history(cls, history):
        for m in history:
            if m['role'] == 'system':
                pass
            if m['role'] == 'user':
                pass
            if m['role'] == 'tool':
                if 'status' in m: del m['status']
            if m['role'] == 'assistant':
                if m.get('tool_calls') and len(m.get('tool_calls')) > 0:
                    for tc in m['tool_calls']:
                        tc['function'] = {
                            'name': tc['name'],
                            'arguments': str(tc['arguments'])
                        }

        return history

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
                    "pack_names": {
                        "description": (
                            "Names of the tool packs to use. "
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
                "required": ["pack_names"]
            }
        }
    }
            ]
            content = []
            reasoning = []
            tool_calls = []
            tool = None

            history = cls.formate_history(history)
            cprint(history, "yellow")
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
                    yield {'type': 'end'}
                    return
                elif getattr(
                    r.choices[0],
                    cls.mapFinishReason("finish_reason")
                ) == cls.mapFinishReason("tool_calls"):
                    for tc in tool_calls:
                        tc['arguments'] = json.loads(''.join(tc['arguments']))
                    yield {'type': 'tool_calls', 'tool_calls': tool_calls}
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
        except Exception as e:
            print(traceback.format_exc())
            yield {'type': 'error', 'content': "internal error: " + str(e)}
