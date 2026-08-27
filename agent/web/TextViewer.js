class TextViewer {

    constructor(renderAtEnd = false) {
        this.renderAtEnd = renderAtEnd;
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

        if(!this.renderAtEnd) this.render();
    }

    render() {
        this.body.innerHTML = this.text;
    }

    end() {
        if (this.renderAtEnd) this.render();
    }
}

export default TextViewer;
