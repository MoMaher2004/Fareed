from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from langchain_core.tools import tool
from states import Request, approval_requests
import time as ori_time

def toUTC(dt: datetime, timeZone: str = "Africa/Cairo") -> datetime:
    """
    Convert a naive or local-time datetime to UTC
    """
    tz = ZoneInfo(timeZone)
    if isinstance(dt, str):
        dt = datetime.strptime(dt, "%Y-%m-%d %H:%M:%S")

    # if naive → assume it's in given timezone
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)
    else:
        dt = dt.astimezone(tz)

    return dt.astimezone(timezone.utc)


def fromUTC(dt: datetime, timeZone: str = "Africa/Cairo") -> datetime:
    """
    Convert a UTC datetime to target timezone
    """
    tz = ZoneInfo(timeZone)
    if isinstance(dt, str):
        dt = datetime.strptime(dt, "%Y-%m-%d %H:%M:%S")

    # ensure it's UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    return dt.astimezone(tz).strftime("%Y-%m-%d %H:%M:%S")

@tool
def time():
    """Returns the current time as a string in formate "%Y-%m-%d %H:%M:%S". Used when current date and time are required. If you output to user, use a letteral format to be readable like: "It's three oclock PM on fifth of September" instead of numbers to be pronounced well."""
    # approval_requests[id] = Request('Get time', 'desc')
    # while approval_requests[id].status == 'waiting': ori_time.sleep(.5)
    # if approval_requests[id].status in ('rejected(timeout)', 'rejected'): raise Exception(f"Approval failed: {approval_requests[id].status}")
    t = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    return fromUTC(t)

__all__ = ['time', 'toUTC', 'fromUTC']