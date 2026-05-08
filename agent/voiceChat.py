from Agent import Agent, tools_map, tools_schema, models
agent = Agent(models["deepseek-chat"], tools_map, tools_schema)
from tools.STTElevenLabs import STTElevenLabs
from tools.TTSCartesia import TTSCartesia

bw = 100
print('='*bw)
print('='*bw)
while True:
    print('-'*bw)
    input('press enter to start...')
    STTElevenLabs.start()
    input('press enter to stop...')
    TTSCartesia.speak(agent.chat(STTElevenLabs.stop()))