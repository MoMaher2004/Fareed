class AudioPlayer {

    constructor(filename = "audio.mp3") {
        this.filename = filename;
        this.url = "";
        this.element = this.create();
    }

    create() {

        const wrapper = document.createElement("div");
        wrapper.className = "audio-player";

        wrapper.innerHTML = `
            <div class="audio-header">
                <span class="audio-filename"></span>

                <a class="audio-download" href="#" download target="_blank">
                    <i class="bi bi-download"></i>
                </a>
            </div>

            <audio preload="metadata"></audio>

            <div class="audio-controls">

                <button class="audio-back">
                    <i class="bi bi-skip-backward-fill"></i>
                </button>

                <button class="audio-play">
                    <i class="bi bi-play-fill"></i>
                </button>

                <button class="audio-forward">
                    <i class="bi bi-skip-forward-fill"></i>
                </button>

                <button class="audio-speed">
                    1x
                </button>

                <button class="audio-loop">
                    <i class="bi bi-arrow-repeat"></i>
                </button>

            </div>

            <div class="audio-progress">

                <span class="audio-current-time">0:00</span>

                <input type="range" class="audio-seek" min="0" max="100" value="0">

                <span class="audio-duration">0:00</span>

            </div>

            <div class="audio-volume">
                🔊
                <input type="range" class="audio-volume-slider" min="0" max="1" step="0.01" value="1">
            </div>
        `;

        // elements
        this.audio = wrapper.querySelector("audio");

        this.playBtn = wrapper.querySelector(".audio-play");
        this.backBtn = wrapper.querySelector(".audio-back");
        this.forwardBtn = wrapper.querySelector(".audio-forward");
        this.speedBtn = wrapper.querySelector(".audio-speed");
        this.loopBtn = wrapper.querySelector(".audio-loop");

        this.seekSlider = wrapper.querySelector(".audio-seek");
        this.volumeSlider = wrapper.querySelector(".audio-volume-slider");

        this.currentTimeLabel = wrapper.querySelector(".audio-current-time");
        this.durationLabel = wrapper.querySelector(".audio-duration");

        this.downloadBtn = wrapper.querySelector(".audio-download");
        this.filenameElement = wrapper.querySelector(".audio-filename");

        return wrapper;
    }

    append(chunk) {
        this.url += chunk;
    }

    formatTime(seconds) {
        if (!Number.isFinite(seconds)) return "0:00";

        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);

        return `${m}:${s.toString().padStart(2, "0")}`;
    }

    updateSeekUI() {
        if (!this.audio.duration) return;

        const percent =
            (this.audio.currentTime / this.audio.duration) * 100;

        this.seekSlider.style.setProperty("--progress", `${percent}%`);
    }

    end() {

        const url = this.url.trim();

        this.audio.src = url;
        this.downloadBtn.href = url;

        this.filenameElement.textContent = this.filename;

        // Download (force blob download)
        // this.downloadBtn.onclick = async () => {

        //     const res = await fetch(url);
        //     const blob = await res.blob();

        //     const blobUrl = URL.createObjectURL(blob);

        //     const a = document.createElement("a");
        //     a.href = blobUrl;
        //     a.download = this.filename;

        //     document.body.appendChild(a);
        //     a.click();
        //     a.remove();

        //     URL.revokeObjectURL(blobUrl);
        // };

        // Play / Pause
        this.playBtn.onclick = () => {

            if (this.audio.paused) {
                this.audio.play();
                this.playBtn.innerHTML = `<i class="bi bi-pause-fill"></i>`;
            } else {
                this.audio.pause();
                this.playBtn.innerHTML = `<i class="bi bi-play-fill"></i>`;
            }
        };

        // Back 10s
        this.backBtn.onclick = () => {
            this.audio.currentTime = Math.max(0, this.audio.currentTime - 10);
        };

        // Forward 10s
        this.forwardBtn.onclick = () => {
            this.audio.currentTime = Math.min(
                this.audio.duration || Infinity,
                this.audio.currentTime + 10
            );
        };

        // Speed control
        const speeds = [1, 1.25, 1.5, 2];
        let speedIndex = 0;

        this.speedBtn.onclick = () => {
            speedIndex = (speedIndex + 1) % speeds.length;

            this.audio.playbackRate = speeds[speedIndex];
            this.speedBtn.textContent = `${speeds[speedIndex]}x`;
        };

        // Loop toggle
        this.loopBtn.onclick = () => {
            this.audio.loop = !this.audio.loop;

            this.loopBtn.style.color =
                this.audio.loop ? "#1db954" : "#fff";
        };

        // Volume
        this.volumeSlider.oninput = () => {
            this.audio.volume = Number(this.volumeSlider.value);
        };

        // Loaded metadata
        this.audio.addEventListener("loadedmetadata", () => {
            this.durationLabel.textContent =
                this.formatTime(this.audio.duration);
        });

        // Time update
        this.audio.addEventListener("timeupdate", () => {

            this.currentTimeLabel.textContent =
                this.formatTime(this.audio.currentTime);

            if (this.audio.duration) {
                this.seekSlider.value =
                    (this.audio.currentTime / this.audio.duration) * 100;
            }

            this.updateSeekUI();
        });

        // Seek
        this.seekSlider.oninput = () => {

            if (!this.audio.duration) return;

            this.audio.currentTime =
                (this.seekSlider.value / 100) * this.audio.duration;

            this.updateSeekUI();
        };

        // End event
        this.audio.addEventListener("ended", () => {

            if (!this.audio.loop) {
                this.playBtn.innerHTML =
                    `<i class="bi bi-play-fill"></i>`;
            }
        });
    }
}

export default AudioPlayer;