from pydantic import BaseModel, Field
from langchain.tools import tool

class Bye(BaseModel):
    """Use it if and only if the user wants to end the conversation."""
    message: str = Field(..., description="The last message you will use to say goodbye.")

@tool(args_schema=Bye)
def bye(message: str):
    print("\n\033[36mFareed:", message, "\033[0m\n")
    print('='*100)
    print('='*100)
    exit()