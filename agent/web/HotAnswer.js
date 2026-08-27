class HotAnswer {

    constructor(renderAtEnd = false, lastMessage = false) {
        this.renderAtEnd = renderAtEnd;
        this.lastMessage = lastMessage;
        this.text = "";
        this.element = this.create();
    }

    create() {
        if (!(!this.renderAtEnd || this.lastMessage && this.renderAtEnd)) return undefined
        const button = document.createElement("button");

        button.className = "btn-suggestion";
        button.setAttribute("role", "button");

        button.textContent = "";

        button.onclick = () => {
            sendMessage(this.text);
        };

        return button;
    }

    append(chunk) {
        if (!(!this.renderAtEnd || this.lastMessage && this.renderAtEnd)) return
        this.text += chunk;

        this.render();
    }

    render() {
        this.element.innerHTML = this.text;
    }

    end() {}
}

export default HotAnswer;
