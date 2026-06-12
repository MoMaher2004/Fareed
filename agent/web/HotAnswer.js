class HotAnswer {

    constructor() {
        this.text = "";
        this.element = this.create();
    }

    create() {
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

        this.text += chunk;

        this.render();
    }

    render() {
        this.element.innerHTML = this.text;
    }

    end() {}
}

export default HotAnswer;