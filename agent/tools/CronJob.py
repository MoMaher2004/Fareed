from tools.DB import DB
from datetime import datetime, timedelta, timezone
import calendar
from pydantic import BaseModel, Field
from tools.time_utils import toUTC, fromUTC
from langchain.tools import tool

try:
    DB.createTable('cron_jobs', [
        'id INTEGER PRIMARY KEY AUTOINCREMENT',
        'start_time DATETIME NOT NULL',
        'dead_time DATETIME NOT NULL',
        'importance TEXT NOT NULL DEFAULT "medium" CHECK(importance IN ("critical", "high", "medium", "low", "ignorable"))',
        'title TEXT NOT NULL',
        'prompt TEXT NOT NULL',
        'on_pass_action TEXT NOT NULL DEFAULT "ask the human"',
        'is_done BOOLEAN DEFAULT FALSE'
    ])
except Exception as e:
    print(f"Error:", e)

class Add(BaseModel):
    """Use it to add new cron job. Fill all the fields from user's answers. Never ever ask the agent in the prompt to response or wait for user input as agent will work silently. Tell it to exit at the end using bye()."""
    start_time: str = Field(..., description="The time when the job is scheduled to start after. Its value in formate '%Y-%m-%d %H:%M:%S'.")
    dead_time: str = Field(..., description="The time when the job is scheduled to be dead and not executable. Its value in formate '%Y-%m-%d %H:%M:%S'.")
    importance: str = Field(..., description="The importance of the job. Its value can fe one of the following ('critical', 'high', 'medium', 'low', 'ignorable').")
    title: str = Field(..., description="A summarized statment that describes the job.")
    prompt: str = Field(..., description="A detailed prompt containing steps in structured form that will be sent to AI agent to perform the job.")
    on_pass_action: str = Field(..., description="A short prompt that describes the action performed for the job it its execution time is passed for some reason. Examples: 'Ask the human weather to execute now or do another action.', 'Excecute the job normally.', etc...")

class Edit(BaseModel):
    """Use it to edit an existing cron job. Fill all the fields from job's information and edit the fields you asked to edit. Never ever ask the agent in the prompt to response or wait for user input as agent will work silently. Tell it to exit at the end using bye()."""
    id: int = Field(..., description="Job's ID to be edited.")
    start_time: str = Field(..., description="The time when the job is scheduled to start after. Its value in formate '%Y-%m-%d %H:%M:%S'.")
    dead_time: str = Field(..., description="The time when the job is scheduled to be dead and not executable. Its value in formate '%Y-%m-%d %H:%M:%S'.")
    importance: str = Field(..., description="The importance of the job. Its value can fe one of the following ('critical', 'high', 'medium', 'low', 'ignorable').")
    title: str = Field(..., description="A summarized statment that describes the job.")
    prompt: str = Field(..., description="A detailed prompt containing steps in structured form that will be sent to AI agent to perform the job.")
    on_pass_action: str = Field(..., description="A short prompt that describes the action performed for the job it its execution time is passed for some reason. Examples: 'Ask the human weather to execute now or do another action.', 'Excecute the job normally.', etc...")

class GetDayItems(BaseModel):
    """Use it to get all jobs in the day execluding their prompts."""
    dayOffset: int = Field(description="How much the day i want to get its jobs far from today. By default 0 (today). Set for 1 for tomorrow, and so on.")

class GetById(BaseModel):
    """Use it to get full information about a cron job by its ID."""
    id: int = Field(..., description="Job's ID to be retrieved.")

class GetWeekItems(BaseModel):
    """Use it to get all jobs in the week execluding their prompts."""
    weekOffset: int = Field(description="How much the week i want to get its jobs far from current week. By default 0 (current week). Set for 1 for next week, and so on.")

class GetMonthItems(BaseModel):
    """Use it to get all jobs in current month execluding their prompts."""

class GetCustomItems(BaseModel):
    """Use it to get all jobs in between two dates execluding their prompts."""
    start: str = Field(..., description="The starting date to get jobs after it and not before. Its value in formate '%Y-%m-%d %H:%M:%S'.")
    end: str = Field(..., description="The ending date to get jobs before it and not after. Its value in formate '%Y-%m-%d %H:%M:%S'.")

class CronJob(DB):
    tbl = 'cron_jobs'

    def __init__(self):
        pass

    @tool(args_schema=Add)
    def CronJob_add(start_time: str, dead_time: str, importance: str, title: str, prompt: str, on_pass_action: str,
            can_be_done_early: bool = False):
        try:
            return DB.add(CronJob.tbl, {
                "start_time": toUTC(start_time),
                "dead_time": toUTC(dead_time),
                "importance": importance,
                "title": title,
                "prompt": prompt,
                "on_pass_action": on_pass_action
            })
        except Exception as e:
            return {'Error', e}

    @tool(args_schema=GetById)
    def CronJob_getById(id: int):
        try:
            rows = DB.get(CronJob.tbl, [('id', '=', id)])
            if not rows:
                return None
            row = rows[0]
            row = dict(row)
            row['start_time'] = datetime.fromisoformat(row['start_time'])
            row['start_time'] = fromUTC(row['start_time'])
            row['dead_time'] = datetime.fromisoformat(row['dead_time'])
            row['dead_time'] = fromUTC(row['dead_time'])
            return row
        except Exception as e:
            return {'Error', e}

    @tool(args_schema=GetDayItems)
    def CronJob_getDayItems(dayOffset: int = 0):
        try:
            lower = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=dayOffset)
            upper = lower + timedelta(days=1)
            rows = DB.get(CronJob.tbl, [('start_time', '>=', lower), ('dead_time', '<', dead_time)])
            result = []
            for r in rows:
                r['start_time'] = datetime.fromisoformat(r['start_time'])
                r['start_time'] = fromUTC(r['start_time'])
                r['dead_time'] = datetime.fromisoformat(r['dead_time'])
                r['dead_time'] = fromUTC(r['dead_time'])
                del r['prompt']
                result.append(r)
            return result
        except Exception as e:
            return {'Error', e}

    @tool(args_schema=GetWeekItems)
    def CronJob_getWeekItems(weekOffset: int = 0):
        try:
            today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            last_saturday = today - timedelta(days=(today.weekday() - 5) % 7) + timedelta(weeks=weekOffset)
            next_saturday = last_saturday + timedelta(days=7)
            rows = DB.get(CronJob.tbl, [('start_time', '>=', last_saturday), ('dead_time', '<', next_saturday)])
            result = []
            for r in rows:
                r['start_time'] = datetime.fromisoformat(r['start_time'])
                r['start_time'] = fromUTC(r['start_time'])
                r['dead_time'] = datetime.fromisoformat(r['dead_time'])
                r['dead_time'] = fromUTC(r['dead_time'])
                del r['prompt']
                result.append(r)
            return result
        except Exception as e:
            return {'Error', e}

    @tool(args_schema=GetMonthItems)
    def CronJob_getMonthItems():
        try:
            today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            start = today.replace(day=1)
            last_day = calendar.monthrange(today.year, today.month)[1]
            end = today.replace(day=last_day) + timedelta(days=1)
            rows = DB.get(CronJob.tbl, [('start_time', '>=', start), ('dead_time', '<', end)])
            result = []
            for r in rows:
                r['start_time'] = datetime.fromisoformat(r['start_time'])
                r['start_time'] = fromUTC(r['start_time'])
                r['dead_time'] = datetime.fromisoformat(r['dead_time'])
                r['dead_time'] = fromUTC(r['dead_time'])
                del r['prompt']
                result.append(r)
            return result
        except Exception as e:
            return {'Error', e}

    @tool(args_schema=GetCustomItems)
    def CronJob_getCustomItems(start: str, end: str):
        try:
            start_dt = datetime.strptime(start, "%Y-%m-%d %H:%M:%S")
            end_dt = datetime.strptime(end, "%Y-%m-%d %H:%M:%S")
            rows = DB.get(CronJob.tbl, [('start_time', '>=', toUTC(start_dt)), ('dead_time', '<', toUTC(end_dt))])
            result = []
            for r in rows:
                r['start_time'] = datetime.fromisoformat(r['start_time'])
                r['start_time'] = fromUTC(r['start_time'])
                r['dead_time'] = datetime.fromisoformat(r['dead_time'])
                r['dead_time'] = fromUTC(r['dead_time'])
                del r['prompt']
                result.append(r)
            return result
        except Exception as e:
            return {'Error', e}

    @tool(args_schema=Edit)
    def CronJob_edit(id: int, start_time: str, dead_time: str, importance: str, title: str, prompt: str,
             on_pass_action: str, can_be_done_early: bool = False):
        try:
            DB.edit(CronJob.tbl, {
                "start_time": toUTC(start_time),
                "dead_time": toUTC(dead_time),
                "importance": importance,
                "title": title,
                "prompt": prompt,
                "on_pass_action": on_pass_action
            },
            [('id', '=', id)])
            return {"status": "success"}
        except Exception as e:
            return {'Error', e}