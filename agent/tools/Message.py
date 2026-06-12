from tools.DB import DB
import uuid
from datetime import datetime

class Message:
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

    def save_message(message: dict):
        """
        Save message into database.
        """
        
        DB.add('MESSAGE', message)

    def get_messages(chat_id: int) -> list:
        """
        Get all messages of a chat.
        """

        return DB.get('MESSAGE', [('chat_id', '=', chat_id)])