from tools.DB import *
import json
from utils import unique_id
import traceback
from termcolor import cprint
import inspect
import tools

class Tool:
    async def tools_pack(pack_names: list, modelName: str) -> list:
        async with DB.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cursor:
                tools = await cursor.execute(
                    f"""SELECT
                        t.*,
                        EXISTS (
                            SELECT 1
                            FROM blacklist b
                            JOIN model m
                            ON b.model_id = m.id
                            WHERE b.tool_id = t.id
                            AND m.name = %s
                        ) AS blacklisted,
                        EXISTS (
                            SELECT 1
                            FROM whitelist w
                            JOIN model m
                            ON w.model_id = m.id
                            WHERE w.tool_id = t.id
                            AND m.name = %s
                        ) AS whitelisted
                    FROM tool t
                    WHERE t.package = ANY(%s)""",
                    [modelName, modelName, pack_names]
                )
                tools = await cursor.fetchall()
                return [dict(t) for t in tools if t['is_active'] and (t['permission_type'] != 'blacklist' or t['blacklisted'] != 1) and (t['permission_type'] != 'whitelist' or t['whitelisted'] == 1)]
    
    tools_map = {
        "tools_pack": tools_pack,
        "time": tools.time,
    }

    async def execute_tool(tool_call_id: str, tool_request: dict, modelName: str = None) -> dict:
        if tool_request['name'] not in Tool.tools_map:
            return {'type': 'tool_response', 'status': 'error', 'content': f"Tool '{tool_request['name']}' not found in tools_map"}

        try:
            result = None
            tool_source = Tool.tools_map[tool_request['name']]
            if hasattr(tool_source, 'invoke'):
                result = tool_source.invoke(json.loads(tool_request['arguments']))
            else:
                cprint(type(tool_request['arguments']), "blue")
                if tool_request['name'] == 'tools_pack':
                    result = tool_source(**json.loads(tool_request['arguments']), modelName=modelName)
                else:
                    result = tool_source(**json.loads(tool_request['arguments']))

            if inspect.isawaitable(result):
                result = await result

            return {'type': 'tool_response', 'status': 'success', "tool_call_id": tool_call_id, "content": str(result)}
        except Exception as e:
            return {'type': 'tool_response', 'status': 'error', 'content': traceback.format_exc()}

    async def process_tool_request(tool_call_id: str, action: str, tool_request: dict) -> dict:
        if action == 'approve':
            return await Tool.execute_tool(tool_call_id, tool_request)
        elif action == 'deny':
            return {'type': 'tool_response', 'tool_call_id': tool_call_id, 'content': 'Tool request denied', 'status': 'denied'}
        else:
            return {'type': 'tool_response', 'status': 'error', 'content': 'invalid action'}

    async def request_tool(modelName:str, tool_call_id: str, tool_name: str, arguments: dict) -> dict:

        if tool_name == "tools_pack":
            tool = {
                'id': None,
                'name': "tools_pack",
                'package': None,
                'description': (
                    "Returns a list of available tools and their descriptions "
                    "so that you can use extra tools according to your needs."
                ),
                'type': 'function',
                'input_schema': {
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
                'required_fields': ["pack_names"],
                'is_active': True,
                'permission_type': 'all',
                'request_permission': False,
                'blacklisted': 0,
                'whitelisted': 0
            }
        else:
            async with DB.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cursor:
                    tool = await cursor.execute(
                        f"""SELECT
                            t.*,
                            EXISTS (
                                SELECT 1
                                FROM blacklist b
                                JOIN model m
                                ON b.model_id = m.id
                                WHERE b.tool_id = t.id
                                AND m.name = %s
                            ) AS blacklisted,
                            EXISTS (
                                SELECT 1
                                FROM whitelist w
                                JOIN model m
                                ON w.model_id = m.id
                                WHERE w.tool_id = t.id
                                AND m.name = %s
                            ) AS whitelisted
                        FROM tool t
                        WHERE t.name = %s""",
                        [modelName, modelName, tool_name]
                    )
                    tool = await cursor.fetchone()

        if not tool:
            return {'type': 'tool_response', 'status': 'error', 'content': 'tool does not exist'}

        if not tool['is_active']:
            return {'type': 'tool_response', 'status': 'error', 'content': 'tool is disabled'}

        if tool['permission_type'] == 'blacklist' and tool['blacklisted'] == 1 or tool['permission_type'] == 'whitelist' and tool['whitelisted'] != 1:
            return {'type': 'tool_response', 'status': 'error', 'content': 'tool can not be used by this model'}

        if tool['request_permission']:
            return {
                'type': 'tool_response',
                'status': 'waiting approval',
                'tool': requests[tool_call_id],
                'options': ['approve', 'deny']
            }
        else:
            return await Tool.execute_tool(
                tool_call_id,
                {
                    'name': tool['name'],
                    'arguments': json.dumps(arguments)
                },
                modelName=modelName
            )