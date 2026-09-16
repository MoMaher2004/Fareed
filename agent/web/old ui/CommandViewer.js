class CommandViewer {

    constructor(renderAtEnd = false) {

        this.renderAtEnd = renderAtEnd;
        this.command = "";

        this.element = this.create();
    }

    create() {

        const wrapper = document.createElement("div");
        wrapper.className = "command-viewer";

        wrapper.innerHTML = `
            <div class="command-header">

                <div class="command-actions">

                    <button class="icon-btn copy-btn">
                        <i class="bi bi-clipboard"></i>
                    </button>

                    <button class="icon-btn expand-btn">
                        <i class="bi bi-arrows-fullscreen"></i>
                    </button>

                </div>

            </div>

            <div class="command-body"></div>
        `;

        this.body = wrapper.querySelector(".command-body");

        this.copyIcon = wrapper.querySelector(".copy-btn i");
        this.expandIcon = wrapper.querySelector(".expand-btn i");

        wrapper.querySelector(".copy-btn").onclick = () => this.copy();
        wrapper.querySelector(".expand-btn").onclick = () => this.expand();

        return wrapper;
    }

    append(chunk) {

        this.command += chunk;

        if(!this.renderAtEnd) this.render();
    }

    end() {
        this.command = this.command.trim()

        this.render()
    }

    render() {

        this.body.innerHTML = "";

        const lines = this.command.split("\n");

        lines.forEach((line, index) => {

            const row = document.createElement("div");
            row.className = "command-line";

            const num = document.createElement("div");
            num.className = "line-num";
            num.textContent = index + 1;

            const command = document.createElement("div");
            command.className = "line-command";

            command.innerHTML = line

            row.appendChild(num);
            row.appendChild(command);

            this.body.appendChild(row);
        });
    }

    copy() {

        navigator.clipboard.writeText(this.command);

        this.copyIcon.className = "bi bi-check-lg";

        setTimeout(() => {
            this.copyIcon.className = "bi bi-clipboard";
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

export default CommandViewer;