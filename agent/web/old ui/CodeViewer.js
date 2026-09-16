class CodeViewer {

    constructor(filename, renderAtEnd = false) {

        this.filename = filename;
        this.renderAtEnd = renderAtEnd;

        this.code = "";

        this.element = this.create();
    }

    create() {

        const wrapper = document.createElement("div");
        wrapper.className = "code-viewer";

        wrapper.innerHTML = `
            <div class="code-header">

                <div class="code-info">
                    <span class="file-name">${this.filename}</span>
                </div>

                <div class="code-actions">

                    <button class="icon-btn copy-btn">
                        <i class="bi bi-clipboard"></i>
                    </button>

                    <button class="icon-btn download-btn">
                        <i class="bi bi-download"></i>
                    </button>

                    <button class="icon-btn expand-btn">
                        <i class="bi bi-arrows-fullscreen"></i>
                    </button>

                </div>

            </div>

            <div class="code-body"></div>
        `;

        this.body = wrapper.querySelector(".code-body");

        this.copyIcon = wrapper.querySelector(".copy-btn i");
        this.downloadIcon = wrapper.querySelector(".download-btn i");
        this.expandIcon = wrapper.querySelector(".expand-btn i");

        wrapper.querySelector(".copy-btn").onclick = () => this.copy();
        wrapper.querySelector(".download-btn").onclick = () => this.download();
        wrapper.querySelector(".expand-btn").onclick = () => this.expand();

        return wrapper;
    }

    append(chunk) {

        this.code += chunk;

        if(!this.renderAtEnd) this.render();
    }

    end() {
        this.code = this.code.trim()

        this.render()
    }

    render() {

        this.body.innerHTML = "";

        const lines = this.code.split("\n");

        lines.forEach((line, index) => {

            const row = document.createElement("div");
            row.className = "code-line";

            const num = document.createElement("div");
            num.className = "line-num";
            num.textContent = index + 1;

            const code = document.createElement("div");
            code.className = "line-code";

            code.innerHTML = //this.highlight(
                this.escape(line)
            //);

            row.appendChild(num);
            row.appendChild(code);

            this.body.appendChild(row);
        });
    }

    escape(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    highlight(code) {

        return code
            .replace(/\b(def|class|return|if|else|for|while|import|from)\b/g,
                '<span class="kw">$1</span>')
            .replace(/(".*?"|'.*?')/g,
                '<span class="str">$1</span>')
            .replace(/(#.*)/g,
                '<span class="com">$1</span>')
            .replace(/\b(\d+)\b/g,
                '<span class="num">$1</span>');
    }

    copy() {

        navigator.clipboard.writeText(this.code);

        this.copyIcon.className = "bi bi-check-lg";

        setTimeout(() => {
            this.copyIcon.className = "bi bi-clipboard";
        }, 1000);
    }

    download() {

        const blob = new Blob([this.code]);
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = this.filename;
        a.click();

        URL.revokeObjectURL(url);

        this.downloadIcon.className = "bi bi-check-lg";

        setTimeout(() => {
            this.downloadIcon.className = "bi bi-download";
        }, 1000);
    }

    expand() {

        this.body.classList.toggle("expanded");

        if (this.body.classList.contains("expanded")) {
            this.expandIcon.className = "bi bi-arrows-collapse";
        } else {
            this.expandIcon.className = "bi bi-arrows-fullscreen";
        }
    }
}

export default CodeViewer;