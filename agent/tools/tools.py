from tools.DB import *
import json
from utils import unique_id

class Tools:
    def get_tool_by_id(id: int) -> list:
        """
        {
            'type': 'function',
            'function': {
                'name': 'createNewRunner',
                'description': 'Use when and if you need to create a python code runner process. The runner stays open to recieve code and execute it untill you end the process. Only the runner is in sandbox but the rest of agent is out.',
                'parameters': {
                    'properties': {
                        'details': {
                            'description': "A description you want to attach to the runner to remember what the purpose of this runner is and its details (ex. 'Create a machine learning model to detect houses pricing based on input data. the code will read '/home/user/datasets/houses.csv' file then do some preprocessing and cleaning then scaling then train KNN model then save it in '.pkl' file.').",
                            'type': 'string'
                        }
                    },
                    'required': ['details'],
                    'type': 'object'
                }
            }
        }
        """
        tool = get('TOOL', [('id', '=', id)])[0]
        return {
            'type': 'function',
            'function': {
                'name': 'createNewRunner',
                'description': 'Use when and if you need to create a python code runner process. The runner stays open to recieve code and execute it untill you end the process. Only the runner is in sandbox but the rest of agent is out.',
                'parameters': {
                    'properties': {
                        'details': {
                            'description': "A description you want to attach to the runner to remember what the purpose of this runner is and its details (ex. 'Create a machine learning model to detect houses pricing based on input data. the code will read '/home/user/datasets/houses.csv' file then do some preprocessing and cleaning then scaling then train KNN model then save it in '.pkl' file.').",
                            'type': 'string'
                        }
                    },
                    'required': ['details'],
                    'type': 'object'
                }
            }
        }