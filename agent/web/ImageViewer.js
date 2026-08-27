class ImageViewer {

    constructor() {
        this.url = "";
        this.element = this.create();
    }

    create() {

        const wrapper = document.createElement("div");
        wrapper.className = "image-viewer";

        return wrapper;
    }

    append(chunk) {
        this.url += chunk;
    }

    end() {
        let url = this.url.trim();

        this.element.innerHTML = `<img src="${url}" width="100%" />`;
    }
}

export default ImageViewer;