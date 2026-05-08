import time


class Request:
    def __init__(self, title, description, time_out=float('inf')):
        self.title = title
        self.description = description
        self.time_out = time_out
        self._status = "waiting"
        self.start = time.time()

    def approve(self):
        self._status = "approved"

    def reject(self):
        self._status = "rejected"

    @property
    def status(self):
        if (
            self._status == "waiting"
            and time.time() - self.start > self.time_out
        ):
            self._status = "rejected(timeout)"

        return self._status


approval_requests = {}