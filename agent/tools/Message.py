from tools.DB import DB
import uuid
from datetime import datetime
from psycopg.rows import dict_row
from termcolor import cprint

class Message:
    @staticmethod
    def create_message(
        chat_id: int,
        role: str,
        content: str
    ) -> dict:
        """
        Creates message object.
        """

        return {
            "chat_id": chat_id,
            "role": role,
            "content": content,
            "created_at": datetime.utcnow().isoformat()
        }

    @staticmethod
    async def save_message(chat_id: int, message: dict):
        """
        Save message into database.
        """
        cprint(message, "green")
        async with DB.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cursor:
                await cursor.execute(
                    f"""UPDATE Chat SET updated_at = %s WHERE id = %s""",
                    (datetime.utcnow().isoformat(), chat_id)
                )
        
                await cursor.execute(
                    f"""INSERT INTO Message
                    (chat_id, role, created_at)
                    VALUES
                    (%s, %s, %s)
                    RETURNING id""",
                    (chat_id, message['role'], datetime.utcnow().isoformat())
                )

                message_id = (await cursor.fetchone())['id']

                if message['role'] == 'system':
                    await cursor.execute(
                        f"""INSERT INTO System_message
                        (message_id, content)
                        VALUES
                        (%s, %s)""",
                        (message_id, message['content'])
                    )
                elif message['role'] == 'user':
                    await cursor.execute(
                        f"""INSERT INTO User_message
                        (message_id, content)
                        VALUES
                        (%s, %s)""",
                        (message_id, message['content'])
                    )
                elif message['role'] == 'tool':
                    await cursor.execute(
                        f"""INSERT INTO Tool_message (message_id, tool_call_id, content) VALUES (%s, %s, %s)""",
                        (message_id, message['tool_call_id'], message['content'])
                    )
                    await cursor.execute(
                        f"""UPDATE Tool_call SET status = %s WHERE tool_call_id = %s""",
                        (message['status'], message['tool_call_id'])
                    )
                elif message['role'] == 'assistant':
                    await cursor.execute(
                        f"""INSERT INTO Assistant_message
                        (message_id, content)
                        VALUES
                        (%s, %s)""",
                        (message_id, message['content'])
                    )
                    if message.get('reasoning_content') is not None:
                        await cursor.execute(
                            f"""INSERT INTO Assistant_reasoning
                            (message_id, content)
                            VALUES
                            (%s, %s)""",
                            (message_id, message['reasoning_content'])
                        )
                    if message.get('tool_calls') is not None and len(message['tool_calls']) > 0:
                        print("\033[36m",message['tool_calls'],"\033[0m")
                        await cursor.executemany(
                            f"""INSERT INTO Tool_call
                            (assistant_message_id, tool_call_id, type, function_name, arguments, status)
                            VALUES
                            (%s, %s, %s, %s, %s, %s)""",
                            [(message_id, tool['id'], tool['type'], tool['name'], str(tool['arguments']), None) for tool in message['tool_calls']]
                        )

        return message_id
