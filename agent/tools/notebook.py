import secrets
import string
import json


class Notebook:

    def __init__(self):
        self.notes = {}

    def _generateId(self):
        characters = string.ascii_letters + string.digits

        while True:
            noteId = "".join(
                secrets.choice(characters)
                for _ in range(9)
            )

            if not self._noteExists(noteId):
                return noteId

    def _noteExists(self, noteId):
        for groupNotes in self.notes.values():
            for note in groupNotes:
                if note["id"] == noteId:
                    return True

        return False

    def addNotes(self, group, notes):
        if not isinstance(group, str) or not group:
            return {
                "status": "error",
                "content": "Group must be a non-empty string"
            }

        if not isinstance(notes, list):
            return {
                "status": "error",
                "content": "Notes must be a list"
            }

        if group not in self.notes:
            self.notes[group] = []

        for note in notes:
            self.notes[group].append({
                "id": self._generateId(),
                "note": note
            })

        return {
            "status": "success",
            "content": "Notes added successfully"
        }

    def modifyNote(self, noteId, value):
        for groupNotes in self.notes.values():
            for note in groupNotes:
                if note["id"] == noteId:
                    note["note"] = value

                    return {
                        "status": "success",
                        "content": "Note modified successfully"
                    }

        return {
            "status": "error",
            "content": "Note not found"
        }

    def deleteNotes(self, noteIds):
        if isinstance(noteIds, str):
            noteIds = [noteIds]

        if not isinstance(noteIds, list):
            return {
                "status": "error",
                "content": "Note IDs must be a string or a list"
            }

        noteIds = set(noteIds)
        found = False

        for group in list(self.notes.keys()):
            originalNotes = self.notes[group]

            remainingNotes = [
                note for note in originalNotes
                if note["id"] not in noteIds
            ]

            if len(remainingNotes) != len(originalNotes):
                found = True

            if remainingNotes:
                self.notes[group] = remainingNotes
            else:
                del self.notes[group]

        if not found:
            return {
                "status": "error",
                "content": "No matching notes found"
            }

        return {
            "status": "success",
            "content": "Notes deleted successfully"
        }

    def deleteGroup(self, group):
        if group not in self.notes:
            return {
                "status": "error",
                "content": "Group not found"
            }

        del self.notes[group]

        return {
            "status": "success",
            "content": "Group deleted successfully"
        }

    def notesToSystemMessage(self):
        notesContent = json.dumps(
            self.notes,
            ensure_ascii=False,
            indent=2
        )

        return {
            "role": "system",
            "content": (
                "The following are the current conversation notes. "
                "Use them as persistent context and keep note IDs unchanged "
                "when referring to or modifying notes.\n\n"
                f"<notes>\n{notesContent}\n</notes>"
                """NOTES PRESERVATION

Treat Notes as persistent conversation state, not temporary scratch space.

Preserve existing notes whenever possible.

Do not delete a note merely because its task, goal, or action has been completed.

For example, if a to-do item is completed, keep the note and update it to reflect its completed state instead of deleting it.

Completed tasks, previous decisions, requirements, important facts, and historical context may remain useful for understanding what has already happened and what should happen next.

Only delete a note when there is a clear reason, such as:

* The note is obsolete and no longer provides useful context.
* The note is incorrect and has been replaced by a correct note.
* The note is an unnecessary duplicate of another note.
* The user explicitly asks for it to be removed.

When information changes, prefer modifying the existing note rather than deleting it and creating a replacement.

Before deleting a note or group, make sure that the information it contains is either no longer useful or is already preserved elsewhere in the Notes.

Use deletion minimally.
"""
            )
        }


    def schema() -> list:
        return [
            {
                "type": "function",
                "function": {
                    "name": "addNotes",
                    "description": (
                        "Adds a note to a specific group in notebook. If group doesn't exist, it creates it and adds the note."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "notes": {
                                "description": "The notes you want to add. it can contain strings like: 'Use postgres in database' in 'project specifications' group, dictionaries like: {'task': 'scraping the URL: https://scarping.com', 'is_done': False}"
                                ,
                                "type": "array"
                            },
                            "group": {
                                "description": "The group where you will add these notes, ex. todo list, specifications, architecture, etc..."
                                ,
                                "type": "string"
                            }
                        },
                        "required": ["notes", "group"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "modifyNote",
                    "description": (
                        "updates a specific note using its ID. Be aware that you will not be able to remember the modified note."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "noteId": {
                                "description": "Note ID that points to the note"
                                ,
                                "type": "string"
                            },
                            "value": {
                                "description": "The new note to replace old one"
                                ,
                                "type": "string"
                            }
                        },
                        "required": ["noteId", "value"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "deleteNotes",
                    "description": (
                        "Delete some notes using their IDs. Use it wisely because you can not remember any deleted note."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "noteIds": {
                                "description": "Note IDs that points to notes that are wanted to be deleted"
                                ,
                                "type": "array",
                                "items": {
                                    "type": "string"
                                }
                            }
                        },
                        "required": ["noteIds"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "deleteGroup",
                    "description": (
                        "Delete an entire group with its notes. Use it wisely because you can not remember any deleted group."
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "group": {
                                "description": "Group name that is wanted to be deleted"
                                ,
                                "type": "string"
                            }
                        },
                        "required": ["group"]
                    }
                }
            },
        ]