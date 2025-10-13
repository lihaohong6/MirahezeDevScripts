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

    /**
     * Return a possible set of audio file src urls
     * @param {string} url Url of the desired audio file
     * @returns Array of possible audio file urls
     */
    function processAudioUrl(url) {
        if (!url.includes("wikitide")) {
            return [url];
        }
        // FIXME: this is dependent on Miraheze's URL structure, which is subject to change in the future.
        // Transform 
        // https://static.wikitide.net/strinovawiki/c/ca/XYZ.ogg 
        // to
        // https://static.wikitide.net/strinovawiki/transcoded/c/ca/XYZ.ogg/XYZ.ogg.mp3
        // Only use ogg if the device supports it
        const urls = [];
        for (let newExtension of ['ogg', 'mp3']) {
            if (url.toLowerCase().endsWith(newExtension)) {
                urls.push(url);
            } else {
                urls.push(url.replace(
                    /wikitide\.net\/([^/]+)\/(.)\/(..)\/(\w+)\.([a-zA-Z0-9]+)$/i,
                    "wikitide.net/$1/transcoded/$2/$3/$4.$5/$4.$5." + newExtension));
            }
        }
        urls.push(url);
        return urls;
    }

    function initAudioPlayer(index, audioPlayer) {
        const dataSet = audioPlayer.dataset;
        const audioGroup = dataSet.group;
        const shouldLoop = dataSet.loop === "true";
        // Always preload unless instructed otherwise
        const shouldPreload = dataSet.preload !== "false";
        const loopStart = parseFloat(dataSet.loopStart);
        const loopEnd = parseFloat(dataSet.loopEnd);
        const isPauseButton = dataSet.pauseButton;
        const filename = dataSet.filename;

        const playButton = audioPlayer.querySelector(".toggle-play");

        const progressBar = audioPlayer.querySelector(".progress");
        const timeline = audioPlayer.querySelector(".timeline");

        let startingVolume = parseFloat(dataSet.volume);
        if (isNaN(startingVolume)) {
            startingVolume = 1;
        }
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
                groups[audioGroup].pause();
            });
            return;
        }

        let muted = false;

        function onAudioPauseOrStop() {
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

        const howler = new Howl({
            src: processAudioUrl(dataSet.src),
            preload: shouldPreload,
            onpause: onAudioPauseOrStop,
            onplay: function () {
                playButton.classList.remove("play");
                playButton.classList.add("pause");
                if (shouldLoop && loopEnd !== 0) {
                    setTimeout(checkBGMLoop, 20);
                }
                // update progress in every set interval
                if ((shouldLoop && loopEnd !== 0) || progressBar || audioCurrentTime) {
                    setTimeout(updateProgress, 100);
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
                setVolumeBarWidth(howler.volume());
            }
        });

        setVolumeBarWidth(startingVolume);
        howler.volume(startingVolume);

        function checkBGMLoop() {
            const seek = howler.seek();
            if (seek >= loopEnd && seek - loopEnd < 0.5) {
                // seek will trigger update progress, so no need to do extra things
                howler.seek(loopStart);
            }
            if (howler.playing) {
                setTimeout(checkBGMLoop, 20);
            }
        }

        function updateProgress() {
            const seek = howler.seek();
            if (progressBar) {
                progressBar.style.width = (seek / howler.duration() * 100) + "%";
            }
            if (audioCurrentTime) {
                audioCurrentTime.innerText = getTimeCodeFromNum(seek);
            }
            if (howler.playing) {
                setTimeout(updateProgress, 20);
            }
        }
        howler.on("seek", updateProgress);

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
                const sliderWidth = window.getComputedStyle(volumeSlider).width;
                const newVolume = e.offsetX / parseInt(sliderWidth);
                howler.volume(newVolume);
            });
        }
    }

    async function audioInit() {
        $(".audio-player").each(initAudioPlayer);
    }

    addScript("https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js", audioInit);
})();