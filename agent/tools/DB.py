from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row
import os
from dotenv import load_dotenv

load_dotenv()  # Ensure DB_* env vars are available even when DB.py is imported standalone

class DB:
    conn = None
    cursor = None

    @classmethod
    async def init(cls):
        cls.pool = AsyncConnectionPool(
            conninfo=(
                f'host={os.getenv("DB_HOST")} '
                f'port={os.getenv("DB_PORT")} '
                f'dbname={os.getenv("DB_NAME")} '
                f'user={os.getenv("DB_USER")} '
                f'password={os.getenv("DB_PASS")}'
            ),
            min_size=2,
            max_size=10,
            open=False,
        )

        await cls.pool.open()
        await cls.pool.wait()

    @classmethod
    async def close(cls):
        await cls.pool.close()

    @classmethod
    def connection(cls):
        return cls.pool.connection()

    # @staticmethod
    # async def createTable(tbl: str, columns: list):
    #     await DB.cursor.execute(
    #         f"""CREATE TABLE IF NOT EXISTS {tbl} ({', '.join(columns)})"""
    #     )
    #     await DB.conn.commit()

    # @staticmethod
    # async def add(tbl: str, row: dict) -> int:
    #     await DB.cursor.execute(
    #         f"""INSERT INTO {tbl}
    #         ({', '.join([k for k, v in row.items()])})
    #         VALUES
    #         ({', '.join(['?' for x in range(len(row))])})""",
    #         tuple([v for k, v in row.items()])
    #     )

    #     i = DB.cursor.lastrowid
    #     await DB.conn.commit()

    #     return i

    # @staticmethod
    # async def get(tbl: str, where: list[tuple] = []):
    #     conditions = []
    #     values = []
    #     w_stmt = ''

    #     for k, op, v in where:
    #         conditions.append(f"{k} {op} ?")
    #         values.append(v)

    #     if len(where) > 0:
    #         w_stmt = f"WHERE {' AND '.join(conditions)}"

    #     await DB.cursor.execute(
    #         f"""SELECT * FROM {tbl} {w_stmt}""",
    #         tuple(values)
    #     )

    #     rows = await DB.cursor.fetchall()

    #     return [dict(r) for r in rows]

    # @staticmethod
    # async def edit(tbl: str, columns: dict, where: list[tuple]):
    #     set_clause = ', '.join([f"{k} = ?" for k, v in columns.items()])
    #     where_clause = ' AND '.join(
    #         [f"{k} {op} ?" for k, op, v in where]
    #     )

    #     values = tuple(
    #         list(columns.values()) +
    #         [v for k, op, v in where]
    #     )

    #     await DB.cursor.execute(
    #         f"""UPDATE {tbl}
    #         SET {set_clause}
    #         WHERE {where_clause}""",
    #         values
    #     )

    #     await DB.conn.commit()

    # @staticmethod
    # async def emptyTable(tbl: str):
    #     await DB.cursor.execute(
    #         f"""DELETE FROM {tbl}"""
    #     )

    #     await DB.conn.commit()