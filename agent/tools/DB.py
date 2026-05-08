import sqlite3

class DB:
    conn = sqlite3.connect('app.db', check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    def __init__(self):
        pass

    def createTable(tbl: str, columns: list):
        DB.cursor.execute(f"""CREATE TABLE IF NOT EXISTS {tbl} ({', '.join(columns)})""")
        DB.conn.commit()

    def add(tbl: str, row: dict):
        DB.cursor.execute(f"""INSERT INTO {tbl}
            ({', '.join([k for k, v in row.items()])})
            VALUES
            ({', '.join(['?' for x in range(len(row))])})""",
            tuple([v for k, v in row.items()])
        )
        i = DB.cursor.lastrowid
        DB.conn.commit()
        return i

    def get(tbl: str, where: list[tuple]):
        conditions = []
        values = []
        w_stmt = ''
        for k, op, v in where:
            conditions.append(f"{k} {op} ?")
            values.append(v)
        if len(where) > 0: w_stmt = f"WHERE {' AND '.join(conditions)}"
        DB.cursor.execute(f"""SELECT * FROM {tbl} {w_stmt}""",
            tuple(values)
        )
        return [dict(r) for r in DB.cursor.fetchall()]

    def edit(tbl: str, columns: dict, where: list[tuple]):
        set_clause = ', '.join([f"{k} = ?" for k, v in columns.items()])
        where_clause = ' AND '.join([f"{k} {op} ?" for k, op, v in where])
        values = tuple(list(columns.values()) + [v for k, op, v in where])
        DB.cursor.execute(f"""UPDATE {tbl} SET {set_clause} WHERE {where_clause}""", values)
        DB.conn.commit()

    def emptyTable(tbl:str):
        DB.cursor.execute(f"""DELETE FROM {tbl}""")
        DB.conn.commit()