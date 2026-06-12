class TextViewer {

    constructor() {
        this.text = "";
        this.element = this.create();
    }

    create() {

        const wrapper = document.createElement("div");
        wrapper.className = "text-viewer";

        wrapper.innerHTML = `<div class="text-body"></div>`;

        this.body = wrapper.querySelector(".text-body");

        return wrapper;
    }

    append(chunk) {

        this.text += chunk;

        this.render();
    }

    render() {
        this.body.innerHTML = this.text;
    }

    end() {}
}

export default TextViewer;