from tools.DB import *
import json
from utils import unique_id
import traceback
from termcolor import cprint
import inspect
import tools
import copy

class Tool:
    def tools_pack_schema() -> dict:
        return {
            "type": "function",
            "function": {
                "name": "tools_pack",
                "description": (
                    "returns a list of available tools and their descriptions "
                    "so that you can use extra tools according to your needs."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "pack_names": {
                            "description": (
                                "names of the tool packs to use. "
                                "you can choose from the following options: "
                                "'PythonRunner' for python execution tools, "
                                "'Artifact' to retrieve artifacts to your context, "
                                # "'ssh' for ssh tools, "
                                # "'cronjob' to manage cron jobs, "
                                # "'updater' for tools you can use to understand "
                                # "your architecture and suggest updates, "
                                "'time' to get time information, "
                                # "'bye' to end the session, "
                                # "'search' for search tools."
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

    
    async def tools_pack(pack_names: list, modelName: str, schema = []) -> list:
        schema = copy.deepcopy(schema)
        async with DB.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cursor:
                pack_names = [name.lower() for name in pack_names]
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
                    WHERE LOWER(t.package) = ANY(%s)""",
                    [modelName, modelName, pack_names]
                )
                tools = await cursor.fetchall()
                for t in tools:
                    if not (t['is_active'] and (t['permission_type'] != 'blacklist' or t['blacklisted'] != 1) and (t['permission_type'] != 'whitelist' or t['whitelisted'] == 1)): continue
                    if any(t["name"] == s['function']['name'] for s in schema): continue
                    formatted_tool = {
                        "type": t["type"],
                        "function": {
                            "strict": True,
                            "name": t["name"],
                            "description": t["description"],
                            "parameters": {
                                "type": "object",
                                "properties": t["input_schema"],
                                "required": t["required_fields"],
                                "additionalProperties": False
                            }
                        }
                    }
                    schema.append(formatted_tool)
                return schema
    
    tools_map = {
        "tools_pack": tools_pack,
        "time": tools.time,
        "createNewRunner": tools.PythonRunner.createNewRunner,
        "executeCode": tools.PythonRunner.executeCode,
        "stopRunner": tools.PythonRunner.stopRunner,
        "modifyRunner": tools.PythonRunner.modifyRunner,
        "runnersList": tools.PythonRunner.runnersList,
        "getArtifact": tools.Artifact.getArtifact,
        "createArtifact": tools.Artifact.createArtifact,
    }

    async def execute_tool(tool_call_id: str, tool_request: dict, modelName: str = None, schema = []) -> dict:
        if tool_request['name'] not in Tool.tools_map:
            return {'type': 'tool_response', 'status': 'error', 'content': f"Tool '{tool_request['name']}' not found in tools_map"}
        try:
            result = None
            tool_source = Tool.tools_map[tool_request['name']]
            if hasattr(tool_source, 'invoke'):
                result = tool_source.invoke(input=tool_request['arguments'])
            else:
                if tool_request['name'] == 'tools_pack':
                    result = tool_source(tool_request['arguments']['pack_names'], modelName=modelName, schema=schema)
                else:
                    result = tool_source(**tool_request['arguments'])

            if inspect.isawaitable(result):
                result = await result

            if tool_request['name'] == "tools_pack": return {'type': 'tool_response', 'status': 'success', "tool_call_id": tool_call_id, "content": "New Tools are added to schema!", "tools_schema": result}
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

    async def request_tool(modelName:str, tool_call_id: str, tool_name: str, arguments: dict, schema = []) -> dict:

        if tool_name == "tools_pack":
            return await Tool.execute_tool(
                tool_call_id,
                {
                    'name': "tools_pack",
                    'arguments': arguments
                },
                modelName=modelName,
                schema=schema
            )
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
                'tool': {"name": tool['name'], "arguments": arguments},
                'options': ['approve', 'deny']
            }
        else:
            return await Tool.execute_tool(
                tool_call_id,
                {
                    'name': tool['name'],
                    'arguments': arguments
                },
                modelName=modelName
            )

    async def update_tool_call_status(tool_call_id, status):
        try:
            async with DB.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cursor:
                    await cursor.execute(
                        f"""UPDATE tool_call SET status = %s WHERE tool_call_id = %s""",
                        (status, tool_call_id)
                    )
            return {"status": "success"}
        except Exception as e:
            return {"status": "error", "content": traceback.format_exc()}