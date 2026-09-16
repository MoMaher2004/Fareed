from tools.DB import DB
import uuid
from datetime import datetime
from tools import time_utils, Message
from tools.Message import Message
import json
from psycopg.rows import dict_row
import ast
from termcolor import cprint

class Chat:
    async def get_chats() -> list:
        """
        Get all chats
        """

        async with DB.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cursor:
                await cursor.execute(
                    '''
                    SELECT
                        c.id,
                        COALESCE(
                            c.title,
                            LEFT(
                                (
                                    SELECT u.content
                                    FROM Message m
                                    LEFT JOIN user_message u ON m.id = u.message_id
                                    WHERE m.chat_id = c.id
                                    AND m.role = 'user'
                                    ORDER BY m.created_at ASC
                                    LIMIT 1
                                ),
                                50
                            ) || '...'
                        ) AS title,
                        c.summary,
                        c.created_at,
                        c.updated_at
                    FROM Chat c
                    ORDER BY c.updated_at DESC
                    ''',
                    ()
                )

                chats = await cursor.fetchall()
                for c in chats:
                    c["id"] = str(c["id"])
                    c["created_at"] = str(c["created_at"])
                    c["updated_at"] = str(c["updated_at"])
        return chats


    async def add_chat() -> dict:
        """
        Add a new chat
        """

        # chat_id = str(uuid.uuid4())
        chat = {
            # "id": chat_id,
            "created_at": time_utils.time(),
            "updated_at": time_utils.time(),
        }
        async with DB.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cursor:
                await cursor.execute(
                    '''
                    INSERT INTO Chat (created_at, updated_at)
                    VALUES (%s, %s)
                    RETURNING *
                    ''',
                    (chat['created_at'], chat['updated_at'])
                )

                chat = await cursor.fetchone()

        chat['created_at'] = time_utils.fromUTC(chat['created_at'])
        chat['updated_at'] = time_utils.fromUTC(chat['updated_at'])
        return chat

    async def get_chat(chat_id: int):
        # -------------------------
        # Chat
        # -------------------------

        async with DB.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cursor:
                await cursor.execute(
                    '''
                    SELECT
                        id,
                        title,
                        summary,
                        created_at,
                        updated_at
                    FROM Chat
                    WHERE id = %s
                    ''',
                    (chat_id,)
                )

                chat = await cursor.fetchone()

                if chat is None:
                    return None

        # -------------------------
        # Messages
        # -------------------------
        async with DB.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cursor:
                await cursor.execute(
                    '''
                    SELECT
                        m.id,
                        m.role,
                        m.created_at,

                        um.content AS user_content,
                        sm.content AS system_content,
                        am.content AS assistant_content,
                        ar.content AS reasoning_content,

                        tm.tool_call_id AS tool_message_tool_call_id,
                        tm.content AS tool_content

                    FROM Message AS m

                    LEFT JOIN User_Message AS um
                        ON um.message_id = m.id

                    LEFT JOIN System_Message AS sm
                        ON sm.message_id = m.id

                    LEFT JOIN Assistant_Message AS am
                        ON am.message_id = m.id

                    LEFT JOIN Assistant_Reasoning AS ar
                        ON ar.message_id = am.message_id

                    LEFT JOIN Tool_Message AS tm
                        ON tm.message_id = m.id

                    WHERE m.chat_id = %s

                    ORDER BY m.created_at ASC, m.id ASC
                    ''',
                    (chat_id,)
                )

                message_rows = await cursor.fetchall()

        # -------------------------
        # Tool Calls
        # -------------------------

        async with DB.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cursor:
                await cursor.execute(
                    '''
                    SELECT
                        tc.tool_call_id,
                        tc.assistant_message_id,
                        tc.type,
                        tc.function_name,
                        tc.arguments,
                        tc.status

                    FROM Tool_Call AS tc

                    JOIN Assistant_Message AS am
                        ON am.message_id = tc.assistant_message_id

                    JOIN Message AS m
                        ON m.id = am.message_id

                    WHERE m.chat_id = %s

                    ORDER BY tc.tool_call_id ASC
                    ''',
                    (chat_id,)
                )

                tool_call_rows = await cursor.fetchall()

        # -------------------------
        # Build Tool Calls
        # -------------------------

        tool_calls_by_message = {}
        tool_requests = {}

        for row in tool_call_rows:
            assistant_message_id = row['assistant_message_id']

            try:
                row['arguments'] = json.loads(row['arguments'])
            except (json.JSONDecodeError, TypeError):
                row['arguments'] = ast.literal_eval(row['arguments'])

            if isinstance(row['arguments'], dict) and 'arguments' in row['arguments']:
                row['arguments'] = row['arguments']['arguments']

            if isinstance(row['arguments'], str):
                try:
                    row['arguments'] = json.loads(row['arguments'])
                except (json.JSONDecodeError, TypeError):
                    row['arguments'] = ast.literal_eval(row['arguments'])

            tool_call = {
                'id': row['tool_call_id'],
                'type': row['type'],
                'name': row['function_name'],
                'status': row['status'],
                'arguments': row['arguments'],
                'function': {
                    'name': row['function_name'],
                    'arguments': row['arguments']
                }
            }

            tool_calls_by_message.setdefault(
                assistant_message_id,
                []
            ).append(tool_call)

            if row['status'] == 'waiting approval':
                tool_requests[row['tool_call_id']] = {
                    'type': row['type'],
                    'name': row['function_name'],
                    'arguments': row['arguments']
                }

        # -------------------------
        # Build Messages
        # -------------------------

        messages = []

        for row in message_rows:
            role = row['role']

            if role == 'user':
                messages.append({
                    'role': 'user',
                    'content': row['user_content']
                })

            elif role == 'system':
                messages.append({
                    'role': 'system',
                    'content': row['system_content']
                })

            elif role == 'assistant':
                message = {
                    'role': 'assistant',
                    'content': row['assistant_content']
                }

                if row['reasoning_content'] is not None:
                    message['reasoning_content'] = (
                        row['reasoning_content']
                    )

                message_id = row['id']

                if message_id in tool_calls_by_message:
                    message['tool_calls'] = (
                        tool_calls_by_message[message_id]
                    )

                messages.append(message)

            elif role == 'tool':
                messages.append({
                    'role': 'tool',
                    'tool_call_id': row['tool_message_tool_call_id'],
                    'content': row['tool_content']
                })
        
        chat['created_at'] = time_utils.fromUTC(chat['created_at'])
        chat['updated_at'] = time_utils.fromUTC(chat['updated_at'])

        return {
            'title': chat['title'],
            'summary': chat['summary'],
            'summary_pointer': chat['summary'] or 0,
            'messages': messages,
            'tool_requests': tool_requests
        }