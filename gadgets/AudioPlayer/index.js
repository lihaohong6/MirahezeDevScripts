/**
 * Author: User:PetraMagna
 * License: CC BY-SA 4.0
 */
/* global Howl */
(function () {
    function addScript(src, callback) {
        var s = document.createElement('script');
        s.setAttribute('src', src);
        s.onload = callback;
        document.body.appendChild(s);
    }

    function getTimeCodeFromNum(num) {
        let seconds = parseInt(num);
        let minutes = Math.floor(seconds / 60);
        seconds -= minutes * 60;
        const hours = Math.floor(minutes / 60);
        minutes -= hours * 60;

        if (hours === 0) return `${minutes}:${String(seconds % 60).padStart(2, 0)}`;
        return `${String(hours).padStart(2, 0)}:${minutes}:${String(
            seconds % 60
        ).padStart(2, 0)}`;
    }

    const groups = {};

    function parsePreload(preload) {
        preload = preload || "";
        preload = preload.toLowerCase();
        if (preload === "true") {
            return true;
        }
        if (preload === "false") {
            return false;
        }
        if (preload === "metadata") {
            return "metadata";
        }
        // Preload by default
        return true;
    }

    function parseNumber(value, fallback) {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? fallback : parsed;
    }

    function initAudioPlayer(index, audioPlayer) {
        const dataSet = audioPlayer.dataset;
        const audioGroup = dataSet.group;
        const shouldLoop = dataSet.loop === "true";
        const useHtml5 = dataSet.html5 === "true";
        // Always preload unless instructed otherwise
        const shouldPreload = parsePreload(dataSet.preload);
        const loopStart = parseNumber(dataSet.loopStart, 0);
        const loopEnd = parseNumber(dataSet.loopEnd, 0);
        const hasLoopRegion = shouldLoop && loopEnd > loopStart;
        const isPauseButton = dataSet.pauseButton;
        const filename = dataSet.filename;

        const playButton = audioPlayer.querySelector(".toggle-play");

        const progressBar = audioPlayer.querySelector(".progress");
        const timeline = audioPlayer.querySelector(".timeline");

        let startingVolume = parseFloat(dataSet.volume);
        if (isNaN(startingVolume)) {
            startingVolume = 1;
        }
        startingVolume = Math.max(0, Math.min(1, startingVolume));
        const volumeButton = audioPlayer.querySelector(".volume-button");
        const volumeButtonIcon = audioPlayer.querySelector(".volume");
        const volumeSlider = audioPlayer.querySelector(".volume-slider");
        const volumePercentage = audioPlayer.querySelector(".volume-percentage");

        const audioTime = audioPlayer.querySelector(".time");
        const audioCurrentTime = audioPlayer.querySelector(".current");
        const audioDivider = audioPlayer.querySelector(".divider");
        const audioLength = audioPlayer.querySelector(".length");

        if (isPauseButton && isPauseButton === "true") {
            playButton.parentElement.addEventListener("click", function () {
                if (groups[audioGroup]) {
                    groups[audioGroup].pause();
                }
            });
            return;
        }

        let muted = false;
        let currentVolume = startingVolume;
        let loopCheckTimeout = null;
        let progressTimeout = null;

        function onAudioPauseOrStop() {
            clearLoopCheck();
            clearProgressUpdate();
            playButton.classList.remove("pause");
            playButton.classList.add("play");
        }

        function howlerLoad() {
            if (howler.state() === "unloaded") {
                howler.load();
            }
        }

        function setVolumeBarWidth(volumeFraction) {
            if (volumePercentage) {
                volumePercentage.style.width = volumeFraction * 100 + '%';
            }
        }

        function setVolume(volumeFraction) {
            currentVolume = Math.max(0, Math.min(1, volumeFraction));
            setVolumeBarWidth(currentVolume);
            howler.volume(currentVolume);
        }

        const howler = new Howl({
            src: [dataSet.src],
            html5: useHtml5,
            preload: shouldPreload,
            volume: startingVolume,
            onpause: onAudioPauseOrStop,
            onplay: function () {
                playButton.classList.remove("play");
                playButton.classList.add("pause");
                if (hasLoopRegion) {
                    scheduleLoopCheck();
                }
                if (hasLoopRegion || progressBar || audioCurrentTime) {
                    scheduleProgressUpdate(100);
                }
            },
            onend: function () {
                if (shouldLoop) {
                    howler.seek(0);
                    howler.play();
                } else {
                    onAudioPauseOrStop();
                }
            },
            onload: function () {
                howler.volume(currentVolume);
                if (audioTime) {
                    audioCurrentTime.innerText = "0:00";
                    audioDivider.innerText = "/";
                    audioLength.innerText = getTimeCodeFromNum(howler.duration());
                }
            },
            onloaderror: function (err) {
                if (audioCurrentTime) {
                    audioCurrentTime.innerText = "Failed to load";
                }
                console.log(err);
            },
            onvolume: function () {
                // Redundant for now but maybe something else changes the volume
                const howlerVolume = howler.volume();
                if (howlerVolume !== currentVolume) {
                    currentVolume = howlerVolume;
                    setVolumeBarWidth(currentVolume);
                }
            }
        });

        setVolumeBarWidth(startingVolume);

        function clearLoopCheck() {
            if (loopCheckTimeout !== null) {
                clearTimeout(loopCheckTimeout);
                loopCheckTimeout = null;
            }
        }

        function scheduleLoopCheck() {
            if (loopCheckTimeout === null) {
                loopCheckTimeout = setTimeout(checkBGMLoop, 20);
            }
        }

        function checkBGMLoop() {
            loopCheckTimeout = null;
            if (!howler.playing()) {
                return;
            }
            const seek = howler.seek();
            if (seek >= loopEnd && seek - loopEnd < 0.5) {
                // seek will trigger update progress, so no need to do extra things
                howler.seek(loopStart);
            }
            scheduleLoopCheck();
        }

        function clearProgressUpdate() {
            if (progressTimeout !== null) {
                clearTimeout(progressTimeout);
                progressTimeout = null;
            }
        }

        function scheduleProgressUpdate(delay) {
            if (progressTimeout === null) {
                progressTimeout = setTimeout(updateProgress, delay);
            }
        }

        function renderProgress() {
            const seek = howler.seek();
            if (progressBar) {
                progressBar.style.width = (seek / howler.duration() * 100) + "%";
            }
            if (audioCurrentTime) {
                audioCurrentTime.innerText = getTimeCodeFromNum(seek);
            }
        }

        function updateProgress() {
            progressTimeout = null;
            renderProgress();
            if (howler.playing()) {
                scheduleProgressUpdate(20);
            }
        }
        howler.on("seek", renderProgress);

        function openFilePage() {
            if (filename) {
                const filepage = "/wiki/File:" + filename;
                window.open(filepage, '_blank').focus();
                return true;
            }
            return false;
        }

        playButton.parentElement.addEventListener("contextmenu", function (event) {
            event.preventDefault();
            // if file page opened, no need to open context menu
            return !openFilePage();
        });

        // controls playing and pausing
        playButton.parentElement.addEventListener("click", function (event) {
            if (event.ctrlKey) {
                const result = openFilePage();
                if (result) {
                    return;
                }
            }
            howlerLoad();
            if (howler.playing()) {
                howler.pause();
            } else {
                if (audioGroup && audioGroup !== "concurrent") {
                    const previousPlaying = groups[audioGroup];
                    if (previousPlaying) {
                        previousPlaying.pause();
                    }
                    groups[audioGroup] = howler;
                }
                howler.play();
            }
        });

        // seek whenever the timeline is clicked
        if (timeline) {
            timeline.addEventListener("click", e => {
                howlerLoad();
                const timelineWidth = window.getComputedStyle(timeline).width;
                const timeToSeek = e.offsetX / parseInt(timelineWidth) * howler.duration();
                howler.seek(timeToSeek);
            });
        }

        function toggleMute() {
            if (muted) {
                howler.mute(false);
                volumeButtonIcon.classList.remove("icon-muted");
                volumeButtonIcon.classList.add("icon-volume-medium");
            } else {
                howler.mute(true);
                volumeButtonIcon.classList.add("icon-muted");
                volumeButtonIcon.classList.remove("icon-volume-medium");
            }
            muted = !muted;
        }

        // controls volume button: either mute or unmute
        if (volumeButton) {
            volumeButton.addEventListener("click", toggleMute);
        }

        // controls volume slider
        if (volumeSlider) {
            volumeSlider.addEventListener('click', e => {
                if (muted) {
                    toggleMute();
                }
                const sliderWidth = volumeSlider.clientWidth || parseFloat(window.getComputedStyle(volumeSlider).width);
                if (!sliderWidth) {
                    return;
                }
                setVolume(e.offsetX / sliderWidth);
            });
        }
    }

    async function audioInit() {
        $(".audio-player").each(initAudioPlayer);
    }

    addScript("https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js", audioInit);
})();
