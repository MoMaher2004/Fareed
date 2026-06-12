class YoutubeViewer {

    constructor() {
        this.url = "";
        this.element = this.create();
    }

    create() {

        const wrapper = document.createElement("div");
        wrapper.className = "youtube-viewer";

        return wrapper;
    }

    append(chunk) {
        this.url += chunk;
    }

    end() {
        let url = this.url.trim();
        if (!url.startsWith("https://www.youtube.com/embed/")) {
            // If the URL is not in the embed format, convert it to the embed format
            const videoIdMatch = url.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
            if (videoIdMatch && videoIdMatch[1]) {
                const videoId = videoIdMatch[1];
                url = `https://www.youtube.com/embed/${videoId}`;
            } else {
                console.error("Invalid YouTube URL:", url);
                return;
            }
        }

        this.element.innerHTML = `<iframe width="560" height="315" src="${url}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    }
}

export default YoutubeViewer;