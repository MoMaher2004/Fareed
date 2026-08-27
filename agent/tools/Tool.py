from tools.DB import *
import json
from utils import unique_id

class Tool:
    tools_map = {}

    async def execute_tool(tool_call_id: str, tool_request: dict) -> dict:
        if tool_request['name'] not in Tool.tools_map:
            return {'type': 'tool_response', 'status': 'error', 'content': f"Tool '{tool_request['name']}' not found in tools_map"}

        try:
            result = None
            tool_source = Tool.tools_map[tool_request['name']]
            if hasattr(tool_source, 'invoke'):
                result = tool_source.invoke(json.loads(tool_request['arguments']))
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

    async def request_tool(modelName:str, tool_call_id: str, tool: str, arguments: dict) -> dict:
        tool = await DB.cursor.execute(
            f"""SELECT
                t.*,
                EXISTS (
                    SELECT 1
                    FROM blacklist b
                    WHERE b.tool_id = t.id
                    AND b.model_id = ?
                ) AS blacklisted,
                EXISTS (
                    SELECT 1
                    FROM whitelist w
                    WHERE w.tool_id = t.id
                    AND w.model_id = ?
                ) AS whitelisted
            FROM tool t
            WHERE t.name = ?""",
            [modelName, modelName, tool]
        )

        if len(tool) == 0:
            return {'type': 'tool_response', 'status': 'error', 'content': 'tool does not exist'}

        tool = tool[0]

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
            return await Tool.execute_tool(tool_call_id)