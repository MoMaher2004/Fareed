import os
import traceback
from langchain_core.utils.function_calling import convert_to_openai_tool
from dotenv import load_dotenv
from tools.time_utils import time
from tools.bye import bye
from tools.PythonRunner import PythonRunner
from tools.DDGS import search
from tools.CronJob import CronJob
from tools.Updater import Updater
import json
from openai import OpenAI
from langchain_core.tools import tool
from pydantic import BaseModel

load_dotenv()

lc_tools = [
    time,
    bye,
    search,
    CronJob.CronJob_add,
    CronJob.CronJob_getById,
    CronJob.CronJob_getDayItems,
    CronJob.CronJob_getWeekItems,
    CronJob.CronJob_getMonthItems,
    CronJob.CronJob_getCustomItems,
    CronJob.CronJob_edit,
    Updater.Updater_getTree,
    Updater.Updater_readFileArray,
    Updater.Updater_createFiles,
    PythonRunner.createNewRunner,
    PythonRunner.executeCode,
    PythonRunner.stopRunner,
    PythonRunner.modifyRunner,
    PythonRunner.runnersList
]

tools_schema = [convert_to_openai_tool(t) for t in lc_tools]

tools_map = {
    'time': time,
    'bye': bye,
    'search': search,
    'CronJob_add': CronJob.CronJob_add,
    'CronJob_getById': CronJob.CronJob_getById,
    'CronJob_getDayItems': CronJob.CronJob_getDayItems,
    'CronJob_getWeekItems': CronJob.CronJob_getWeekItems,
    'CronJob_getMonthItems': CronJob.CronJob_getMonthItems,
    'CronJob_getCustomItems': CronJob.CronJob_getCustomItems,
    'CronJob_edit': CronJob.CronJob_edit,
    'Updater_getTree': Updater.Updater_getTree,
    'Updater_readFileArray': Updater.Updater_readFileArray,
    'Updater_createFiles': Updater.Updater_createFiles,
    'modifyRunner': PythonRunner.modifyRunner,
    'runnersList': PythonRunner.runnersList,
    'stopRunner': PythonRunner.stopRunner,
    'executeCode': PythonRunner.executeCode,
    'createNewRunner': PythonRunner.createNewRunner
}

models = {
    "deepseek-chat": {
        "name": "deepseek-chat",
        "api_key": os.getenv("DEEPSEEK_API_KEY"),
        "base_url": "https://api.deepseek.com/v1"
    },
    "deepseek-reasoner": {
        "name": "deepseek-reasoner",
        "api_key": os.getenv("DEEPSEEK_API_KEY"),
        "base_url": "https://api.deepseek.com/v1"
    },
    "dphn/Dolphin-Mistral-24B-Venice-Edition:featherless-ai": {
        "name": "dphn/Dolphin-Mistral-24B-Venice-Edition:featherless-ai",
        "api_key": os.getenv("HF_TOKEN"),
        "base_url": "https://router.huggingface.co/v1"
    },
}

class Agent:
    global models
    def _clear_reasoning_content(self):
        for message in self.history:
            if hasattr(message, 'reasoning_content'):
                message.reasoning_content = None
            elif isinstance(message, dict):
                message.pop('reasoning_content', None)

    def chat(self, message):
        try:
            self._clear_reasoning_content()

            self.history.append({"role": "user", "content": message})

            while True:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        *self.history
                    ],
                    tools=self.tools_schema,
                )

                msg = response.choices[0].message
                self.history.append(msg)

                if not msg.tool_calls:
                    return msg.content

                for tc in msg.tool_calls:
                    tool_name = tc.function.name
                    tool_args = json.loads(tc.function.arguments)
                    result = None
                    try:
                        if tool_name not in self.tools_map:
                            raise ValueError(f"Tool '{tool_name}' not found in tools_map")

                        tool = self.tools_map[tool_name]

                        if hasattr(tool, 'invoke'):
                            result = tool.invoke(tool_args)
                        else:
                            result = tool(**tool_args)
                    except Exception as e:
                        result = {"error": traceback.format_exc()}

                    self.history.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": str(result),
                    })

        except Exception as e:
            print(f"\033[31mHistory: {self.history}\033[0m")
            print(f"\033[32mError: {e}\033[0m")

    def stream(self, message):
        try:
            self._clear_reasoning_content()

            self.history.append({"role": "user", "content": message})

            while True:

                content = []
                tool_calls = []
                tool = None
                for r in self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        *self.history
                    ],
                    tools=self.tools_schema,
                    stream=True
                ):
                    if r.choices[0].finish_reason == 'stop': return
                    if r.choices[0].delta.tool_calls != None:
                        if r.choices[0].delta.tool_calls[0].function.name:
                            yield "\n"
                            tool = {
                                'name': r.choices[0].delta.tool_calls[0].function.name,
                                'arguments': [],
                                'id': r.choices[0].delta.tool_calls[0].id,
                                'type': r.choices[0].delta.tool_calls[0].type
                            }
                            tool_calls.append(tool)
                        else:
                            tool['arguments'].append(r.choices[0].delta.tool_calls[0].function.arguments)
                    else:
                        yield r.choices[0].delta.content
                        content.append(r.choices[0].delta.content)
                content = ''.join(content)
                tool_calls = [
                    {
                        'name': c['name'],
                        'type': c['type'],
                        'function': {
                            'name': c['name'],
                            'arguments': ''.join(c['arguments'])
                        },
                        'arguments': ''.join(c['arguments']),
                        'id': c['id']
                    } for c in tool_calls]
                msg = {
                    'role': 'assistant',
                    'content': content,
                    'tool_calls': tool_calls if len(tool_calls) > 0 else None
                }
                self.history.append(msg)

                for tc in tool_calls:
                    tool_name = tc['name']
                    tool_args = json.loads(tc['arguments'])
                    tool_args['id'] = tc['id']
                    result = None
                    try:
                        if tool_name not in self.tools_map:
                            raise ValueError(f"Tool '{tool_name}' not found in tools_map")

                        tool = self.tools_map[tool_name]

                        if hasattr(tool, 'invoke'):
                            result = tool.invoke(tool_args)
                        else:
                            result = tool(**tool_args)
                    except Exception as e:
                        result = {"error": traceback.format_exc()}

                    self.history.append({
                        "role": "tool",
                        "tool_call_id": tc['id'],
                        "content": str(result),
                    })

        except Exception as e:
            print(f"\033[31mHistory: {self.history}\033[0m")
            print(f"\033[32mError: {e}\033[0m")

    def set_model(self, model):
        self.model = model['name']
        self.client = OpenAI(api_key=model['api_key'], base_url=model['base_url'])

    def __init__(self, model, tools_map, tools_schema):
        self.set_model(model)

        class History(BaseModel):
            """Use it if and only if you need to show current conversation history. Respond to the user with a raw list of dictionaries in readable formate. Example: [{'role': 'system','content': 'You are Fareed, The personal assistant of Mohamed Maher. You are here to assist Mohamed Maher and answer his questions. Whenever you are asked to do something, check first if you have a detecated tool for that, if so, use it, if not, think about a workaround using one of existing tool that can indirectly do it then ask the user to use this tool in that way or not.'},{'role': 'assistant','content': 'Hi, I'm Fareed. How can I help you?'},{'role': 'user','content': 'Hi, What is the time now'},{'role': 'assistant','content': 'I'll check the current time for you.','tool_calls': [{'name': 'time', 'arguments': {}}]},{'role': 'tool','content': '2026-03-20 15:31:11'},{'role': 'assistant','content': 'The current time is March 20, 2026, 15:31:11 (3:31 PM).'}]"""

        @tool(args_schema=History)
        def chatHistory() -> list:
            return self.history

        self.chatHistory = tool()(chatHistory)

        self.tools_map = tools_map
        self.tools_map['chatHistory'] = self.chatHistory
        self.tools_schema = tools_schema
        tools_schema.append(convert_to_openai_tool(self.chatHistory))
        self.system_prompt = """You are Fareed, the personal assistant of Mohamed Maher.

Role:
- Assist Mohamed Maher and answer his questions accurately and efficiently.

Response style:
- Keep answers concise by default.
- Provide detailed explanations only if explicitly requested.

Tool usage policy:
- Before answering, check if a dedicated tool exists for the task.
- If a suitable tool exists → use it.
- If no direct tool exists:
  - Look for a workaround using available tools.
  - If a workaround is possible → guide the user clearly on how to use it.
  - If not possible → answer normally.

Decision rules:
- Prefer correct tool usage over manual explanation when applicable.
- Do not hallucinate tools or capabilities.
- Be practical and solution-oriented.

---

You must format every response using ONLY these tags:

- <*&TEXT&*> for text
- <*&CODE:filename=...:lang=...&*> for code
- <*&COMMAND&*> for commands
- <*&IMAGE&*> for images
- <*&PDF&*> for PDF files
- <*&AUDIO&*> for audio
- <*&YOUTUBE&*> for YouTube embeds
- <*&HOTANSWER&*> for hot answers
- <*&HTML&*> for tags of text formating like: H1-6, ul, ol, li, table, coloring, etc...
- <*&END&*> to end the response (required)

Rules:
- ALWAYS end with <*&END&*>
- DO NOT output anything outside tags
- Tags are case-sensitive and must match exactly
- You can use multiple TEXT, CODE, etc. blocks in one response
- Hot answers are optional and their content's length is too short

Formatting rules:
- No spaces inside tag brackets
- All attributes must be included exactly as defined
- Do not invent new tags

Examples:

<*&TEXT&*>Here is your code:
<*&CODE:filename=main.py:lang=python&*>print("Hello")
<*&TEXT&*>Run it:
<*&COMMAND&*>python3 main.py
<*&TEXT&*>Do you want me to execute it ?
<*&HOTANSWER&*>Yes
<*&HOTANSWER&*>No
<*&END&*>

<*&TEXT&*>Watch this:
<*&YOUTUBE&*>https://www.youtube.com/embed/CG48pSyK8GU
<*&END&*>

<*&TEXT&*>Read the following list:
<*&HTML&*><ol><li>item1</li><li>item2</li></ol>
<*&TEXT&*>Another text
<*&END&*>
"""
        self.history = [
            {"role": "system", "content": self.system_prompt},
            {"role": "assistant", "content": "Hi, I'm Fareed. How can I help you?"}
        ]
