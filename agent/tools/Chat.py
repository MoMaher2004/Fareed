from tools.DB import DB
import uuid
from datetime import datetime

class Chat:
    def get_chats() -> list:
        """
        Get all chats
        """

        return DB.get('CHAT')