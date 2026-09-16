from abc import ABC, abstractmethod
from openai import OpenAI
from tools.Tool import Tool
import traceback
import json
from termcolor import cprint
import ast
from copy import deepcopy

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
        history = deepcopy(history)
        for m in history:
            if m['role'] == 'system':
                pass
            if m['role'] == 'user':
                pass
            if m['role'] == 'tool':
                if 'status' in m: del m['status']
                if 'full_content' in m: del m['full_content']
            if m['role'] == 'assistant':
                if m.get('tool_calls') and len(m.get('tool_calls')) > 0:
                    for tc in m['tool_calls']:
                        tc['function'] = {
                            'name': tc.get('name'),
                            'arguments': str(tc.get('arguments'))
                        }
                if m.get('reasoning'):
                    m['reasoning_content'] = m['reasoning']
                    del m['reasoning']
        return history

    @classmethod
    async def stream(cls, history, tools_schema = []):
        try:
            toolsSchema = tools_schema
            content = []
            reasoning = []
            tool_calls = []
            tool = None
            
            history = cls.formate_history(history)
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
                        raw = ''.join(tc['arguments'])
                        try:
                            tc['arguments'] = json.loads(raw)
                        except (json.JSONDecodeError, TypeError):
                            tc['arguments'] = ast.literal_eval(raw)

                        if isinstance(tc['arguments'], dict) and 'arguments' in tc['arguments']:
                            tc['arguments'] = tc['arguments']['arguments']

                        if isinstance(tc['arguments'], str):
                            try:
                                tc['arguments'] = json.loads(tc['arguments'])
                            except (json.JSONDecodeError, TypeError):
                                tc['arguments'] = ast.literal_eval(tc['arguments'])
                    yield {'type': 'tool_calls', 'tool_calls': json.loads(json.dumps(tool_calls))}
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
            yield {'type': 'error', 'content': "internal error: " + str(e)}
            print(traceback.format_exc())

    @classmethod
    async def chat(cls, history, tools_schema=[]):
        try:
            toolsSchema = tools_schema

            history = cls.formate_history(history)

            response = OpenAI(
                api_key=cls.apiKey,
                base_url=cls.url
            ).chat.completions.create(
                model=cls.name,
                messages=history,
                tools=toolsSchema,
                stream=False
            )

            message = response.choices[0]
            message.finish_reason = cls.mapFinishReason(message.finish_reason)
            return message
            
            # finish_reason = getattr(
            #     response.choices[0],
            #     cls.mapFinishReason("finish_reason")
            # )

            # if finish_reason == cls.mapFinishReason("tool_calls"):
            #     tool_calls = []

            #     for tc in message.tool_calls or []:
            #         arguments = tc.function.arguments

            #         try:
            #             arguments = json.loads(arguments)
            #         except (json.JSONDecodeError, TypeError):
            #             arguments = ast.literal_eval(arguments)

            #         if isinstance(arguments, dict) and "arguments" in arguments:
            #             arguments = arguments["arguments"]

            #         if isinstance(arguments, str):
            #             try:
            #                 arguments = json.loads(arguments)
            #             except (json.JSONDecodeError, TypeError):
            #                 arguments = ast.literal_eval(arguments)

            #         tool_calls.append({
            #             "name": tc.function.name,
            #             "arguments": arguments,
            #             "id": tc.id,
            #             "type": tc.type
            #         })

            #     return {
            #         "type": "tool_calls",
            #         "tool_calls": tool_calls
            #     }

            # if finish_reason == cls.mapFinishReason("stop"):
            #     return {
            #         "type": "message",
            #         "content": message.content,
            #         "reasoning": getattr(
            #             message,
            #             "reasoning_content",
            #             None
            #         )
            #     }

            # return {
            #     "type": "error",
            #     "content": f"Unknown finish reason: {finish_reason}"
            # }

        except Exception as e:
            print(traceback.format_exc())

            return {
                "type": "error",
                "content": "internal error: " + str(e)
            }