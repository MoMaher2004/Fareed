import time
import random
from tools import DB


def unique_id():
    table_name = "unique_id"
    id_column = "id"

    db_cursor = DB.cursor

    DB.createTable(table_name, [f"{id_column} INTEGER PRIMARY KEY"])

    while True:
        timestamp_part = int(str(int(time.time() * 1000))[-7:])
        random_part = random.randint(0, 99999)

        new_id = int(f"{timestamp_part}{random_part:05d}")

        try:
            db_cursor.execute(
                f"INSERT INTO {table_name} ({id_column}) VALUES (?)",
                (new_id,)
            )
            DB.commit()
            return new_id

        except Exception:
            continue