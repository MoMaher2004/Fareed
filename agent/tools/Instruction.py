from tools.DB import DB
from utils.instruction_embedding import *
from psycopg.types.json import Jsonb
from psycopg.rows import dict_row
import json

KEYWORD_WEIGHT = 0.20
VECTOR_WEIGHT = 0.80

TOP_P = 0.80
RELATIVE_THRESHOLD = 0.80
ABSOLUTE_THRESHOLD = 0.80


async def search_instructions(query: str, keywords: list[str], model = None):
    log = {
        "keyword_weight": KEYWORD_WEIGHT,
        "vector_weight": VECTOR_WEIGHT,
        "top_p": TOP_P,
        "relative_threshold": RELATIVE_THRESHOLD,
        "absolute_threshold": ABSOLUTE_THRESHOLD,
        "used_keywords": keywords,
        "query": query
    }
    # select instructions and (No. keywords/ query keywords count) as kwscore from keywords with ignorance of zero scored
    async with DB.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cursor:
            if len(keywords) > 0:
                await cursor.execute(
                    '''
                    SELECT
                        instruction_id,
                        COUNT(*)::float / %s AS kwscore
                    FROM instruction_keyword
                    WHERE keyword = ANY(%s)
                    GROUP BY instruction_id
                    ORDER BY kwscore DESC;
                    ''',
                    (len(keywords), keywords)
                )

                kwrows = await cursor.fetchall()
            if len(keywords) == 0 or len(kwrows) == 0:
                await cursor.execute(
                    '''
                    SELECT
                        id AS instruction_id,
                        0::float AS kwscore
                    FROM instruction
                    ''',
                    ()
                )

                kwrows = await cursor.fetchall()
    
    # normalize kwscores (sum = 1)
    if len(kwrows) > 0:
        kwscore_sum = sum(
            row['kwscore']
            for row in kwrows
        )
        if kwscore_sum > 0:
            for row in kwrows:
                row['kwscore'] /= kwscore_sum
    log["kwscore"] = [{"instruction_id": str(kw["instruction_id"]), "kwscore": kw["kwscore"]} for kw in kwrows]

    kw_map = {
        item['instruction_id']: item['kwscore']
        for item in kwrows
    }

    # embed query
    embedded_query = embed_texts(query)
    embedded_query = (
        '['
        + ','.join(map(str, embedded_query))
        + ']'
    )
    log["embedded_query"] = embedded_query
    
    # search by embedding using cosine similarity as vscore
    async with DB.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cursor:
            await cursor.execute(
                '''
                WITH scored AS (
                    SELECT
                        instruction_id,
                        embedded_text,
                        1 - (embedding <=> %s::vector) AS vscore
                    FROM instruction_embedding
                    WHERE instruction_id = ANY(%s::uuid[])
                )

                SELECT
                    instruction_id,
                    embedded_text,
                    vscore
                FROM (
                    SELECT DISTINCT ON (instruction_id)
                        instruction_id,
                        embedded_text,
                        vscore
                    FROM scored
                    ORDER BY instruction_id, vscore DESC
                ) AS best_per_instruction
                ORDER BY vscore DESC
                LIMIT 5;
                ''',
                (embedded_query, [item['instruction_id'] for item in kwrows])
            )

            vrows = await cursor.fetchall()
    log["vrows"] = [{"instruction_id": str(v["instruction_id"]), "vscore": v["vscore"], "embedded_text": v["embedded_text"]} for v in vrows]

    # make a descending orderd list of tubles (instruction, (kwscore * .2 + vscore * .8))
    v_map = {
        item['instruction_id']: item['vscore']
        for item in vrows
    }

    merged = [
        (
            str(item['instruction_id']),
            kw_map[item['instruction_id']] * KEYWORD_WEIGHT
            + item['vscore'] * VECTOR_WEIGHT
        )
        for item in vrows
        if item['instruction_id'] in kw_map
    ]

    merged.sort(key=lambda item: item[1], reverse=True)
    log["merged"] = merged

    # drop lower that ABSOLUTE_THRESHOLD
    for i in range(len(merged)):
        if ABSOLUTE_THRESHOLD > merged[i][1]:
            merged = merged[:i]
            break

    # select top_p = .8
    top_p_sum = 0
    for i in range(len(merged)):
        top_p_sum += merged[i][1]
        if top_p_sum >= TOP_P:
            merged = merged[:i]
            break
    log["top_p_merged"] = merged

    # drop scores lower than 90% of the highest score
    if len(merged) > 0:
        threshold = merged[0][1] * RELATIVE_THRESHOLD
        for i in range(len(merged)):
            if threshold > merged[i][1]:
                merged = merged[:i]
                break
    log["threshold_merged"] = merged

    # save detailed data about proccess in instruction_search_calls table
    async with DB.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cursor:
            await cursor.execute(
                '''
                INSERT INTO instruction_search_calls
                (query, keywords, model, data) VALUES
                (%s, %s, %s, %s)
                ''',
                (query, keywords, model, Jsonb(log))
            )

    # if no. filtered instructions <= 1, return it
    # if no. filtered instructions > 1, return a message to orcasterator to ask user to choose an instruction

    if len(merged) == 0:
        return {
            "status": "success",
            "content": "There is no sutable instruction found. Try another search arguments or Tell the user about that.",
        }
    elif len(merged) == 1:
        async with DB.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cursor:
                await cursor.execute(
                    '''
                    SELECT * FROM instruction WHERE id = %s
                    ''',
                    (merged[0][0], )
                )

                row = await cursor.fetchone()
        return {
            "status": "success",
            "content":json.dumps({
                "instructions": row["instructions"],
            }, default=str)
        }
    else:
        async with DB.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cursor:
                await cursor.execute(
                    '''
                    SELECT * FROM instruction WHERE id = ANY(%s)
                    ''',
                    ([i for i, score in merged], )
                )

                rows = await cursor.fetchall()
        return {
            "status": "success",
            "content": json.dumps({
                    "message": (
                    "Multiple instruction sets matched. "
                    "Ask the user to choose one."
                ),
                "candidate_names": [row['name'] for row in rows]
            }, default=str)
        }

async def get_instruction(name: str):
    async with DB.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cursor:
            await cursor.execute(
                '''
                SELECT * FROM instruction WHERE name = %s
                ''',
                (name, )
            )

            row = await cursor.fetchone()
    return {"id": row["id"], "name": row["name"]} if row else {}

async def add_instruction(name: str, instructions, keywords: list[str], descriptions: list[str]):
    async with DB.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cursor:
            await cursor.execute(
                '''
                INSERT INTO instruction (name, instructions)
                VALUES (%s, %s) RETURNING id
                ''',
                (name, instructions)
            )

            row = await cursor.fetchone()
            iid = row['id']

            await cursor.executemany(
                '''
                INSERT INTO instruction_keyword (instruction_id, keyword)
                VALUES (%s, %s)
                ''',
                [(iid, k) for k in keywords]
            )

            description_rows = []
            for d in descriptions:
                e = embed_text(d)
                description_rows.append((iid, d, e))

            await cursor.executemany(
                '''
                INSERT INTO Instruction_embedding (instruction_id, embedded_text, embedding)
                VALUES (%s, %s, %s)
                ''',
                description_rows
            )

async def get_instructions_list():
    async with DB.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cursor:
            await cursor.execute(
                '''
                SELECT id, name FROM instruction
                ''',
                ()
            )

            rows = await cursor.fetchall()
    return [{"id": str(r["id"]), "name": r["name"]} for r in rows]

async def delete_instruction(id):
    async with DB.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cursor:
            await cursor.execute(
                '''
                DELETE FROM instruction WHERE id = %s
                ''',
                (id, )
            )

def schema() -> list:
    return [
        {
            "type": "function",
            "function": {
                "name": "search_instructions",
                "description": (
                    "Search for instruction sets suitable for the current task. "
                    "Use this tool before performing a task when you need "
                    "instructions to follow."
                ),
                "parameters": {
                    "additionalProperties": False,
                    "type": "object",
                    "properties": {
                        "query": {
                            "description": (
                                "A short natural-language description of the task you need "
                                "the instruction set for. Describe what you want to accomplish, "
                                "not how to accomplish it."
                            )
                            ,
                            "type": "string"
                        },
                        "keywords": {
                            "description": (
                                "One-word keywords related to the task, used to filter "
                                "candidate instruction sets. Use specific task-related words "
                                "such as \"web\", \"scrape\", \"extraction\", or \"browser\". "
                                "Each keyword must be a single word."
                            )
                            ,
                            "type": "array",
                            "items": {
                                "type": "string",
                                "pattern": "^[A-Za-z]+$"
                            }
                        }
                    },
                    "required": ["query", "keywords"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_instruction",
                "description": (
                    "Retrieve the full instruction set using the exact name "
                    "of a previously identified instruction."
                ),
                "parameters": {
                    "additionalProperties": False,
                    "type": "object",
                    "properties": {
                        "name": {
                            "description": "Name of instruction set to get the full set."
                            ,
                            "type": "string"
                        }
                    },
                    "required": ["name"]
                }
            }
        }
    ]