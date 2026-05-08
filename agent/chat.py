from Agent import Agent, tools_map, tools_schema, models
agent = Agent(models["deepseek-chat"], tools_map, tools_schema)
bw = 100
i = ""
print('='*bw)
print('='*bw)
print("\n\033[36mFareed: Hi, I'm Fareed. How can I help you?\033[0m\n")
auto_input = ['try to get time. dont do workarrounds to get it. if it failed, provide the error message.', 'bye.']
idx = 0
while True:
    print('-'*bw)
    print("\033[32m")
    if idx >= len(auto_input):
        i = input('You: ')
    else:
        i = auto_input[idx]
        print("You:", i)
        idx += 1
    # if i == "EOF": print(agent.history)
    print("\033[0m")
    print('-'*bw)
    print("\n\033[36mFareed: ", end='')
    for c in agent.stream(i):
        print(c, end='', flush=True)
    # print(agent.chat(i))
    print("\033[0m\n")