import subprocess
import sqlite3
from datetime import datetime, timezone, timedelta
import base64
import threading
import time
from Agent import Agent, tools_map, tools_schema, models
agent = Agent(models["deepseek-chat"], tools_map, tools_schema)

conn = sqlite3.connect('app.db', check_same_thread=False)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

jobs = []
lock = threading.Lock()
exit_flag = False

def search():
    global cursor
    global jobs
    global exit_flag
    while not exit_flag:
        now = datetime.now(timezone.utc)
        start = now.replace(second=0, microsecond=0)
        res = cursor.execute(f"""SELECT * FROM cron_jobs WHERE start_time <= ? AND dead_time > ? AND is_done = 0""", (start, start))
        new_jobs = []
        for r in res:
            r = dict(r)
            r['start_time'] = datetime.fromisoformat(r['start_time'])
            r['dead_time'] = datetime.fromisoformat(r['dead_time'])
            level = {"critical":1, "high":2, "medium":3, "low":4, "ignorable":5}.get(r['importance'], 5) * 100000
            remaining = (r['dead_time'] - now).total_seconds() / 100000
            r['priority'] = level + remaining
            new_jobs.append(r)
        with lock:
            jobs.clear()
            jobs.extend(new_jobs)
            jobs.sort(key=lambda obj: obj['priority'])
        time.sleep(1)

def run_job():
    global cursor
    global jobs
    global exit_flag
    while not exit_flag:
        with lock:
            current = jobs.pop(0) if jobs else None
        if current is not None:
            agent.chat(current['prompt'])
            cursor.execute(f"""UPDATE cron_jobs SET is_done = 1 WHERE id = ?""",(current['id'],))
            conn.commit()
        time.sleep(1)

update = threading.Thread(target=search)
execute = threading.Thread(target=run_job)

update.start()
execute.start()

while True:
    if input("\nType \"exit\" to stop service:\n") == "exit":
        exit_flag = True
        update.join()
        execute.join()
        exit()