/**
 * Author: User:PetraMagna
 * License: CC BY-SA 4.0
 */
(function() {
    function addScript( src, callback ) {
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

    async function checkOggOpusSupport() {
        if (!('mediaCapabilities' in navigator)) {
            console.warn('MediaCapabilities API not supported');
            return false;
        }
        
        const mediaConfig = {
            type: 'file',
            audio: {
                contentType: 'audio/ogg; codecs="opus"',
                channels: 2,
                bitrate: 64000,
                samplerate: 44100
            }
        };
        
        try {
            const result = await navigator.mediaCapabilities.decodingInfo(mediaConfig);
            return result.powerEfficient;
        } catch (e) {
            console.error('Error while checking media capabilities:', e);
            return false;
        }
    }
    
    /* File extensions for which the original audio instead of the transcoded version should be played */
    /* Should default to true since that is the safer option */
    let fileExtensionUseTranscoded = {
        "mp3": false,
        "wav": false,
        "ogg": false,
        "flac": true,
    };
    const groups = {};

    /**
     * Checks whether the browser supports the container format in the url. If not, return a different
     * url pointing to the transcoded mp3 file on Miraheze's server.
     * @param {string} url Url of the desired audio file
     * @returns string Url to playable audio file
     */
    function processAudioUrl(url) {
        const index = url.search(/\.[a-zA-Z0-9]+$/i);
        if (index === -1) {
            return url;
        }
        const fileExtension = url.substring(index + 1).toLowerCase();
        // Always use transcoded version unless this extension is in the whitelist
        if (fileExtensionUseTranscoded[fileExtension] === false) {
            return url;
        }
        // FIXME: this is dependent on Miraheze's URL structure, which is subject to change in the future.
        // Transform 
        // https://static.wikitide.net/strinovawiki/c/ca/XYZ.ogg 
        // to
        // https://static.wikitide.net/strinovawiki/transcoded/c/ca/XYZ.ogg/XYZ.ogg.mp3
        return url.replace(/wikitide\.net\/([^/]+)\/(.)\/(..)\/(\w+)\.ogg/i, "wikitide.net/$1/transcoded/$2/$3/$4.ogg/$4.ogg.mp3");
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

        const playerId = "audio" + index;
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
            playButton.parentElement.addEventListener("click", function() {
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

        const howler = new Howl({
            src: [processAudioUrl(dataSet.src)],
            preload: shouldPreload,
            onpause: onAudioPauseOrStop,
            onplay: function() {
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
            onend: function() {
                if (shouldLoop) {
                    howler.seek(0);
                    howler.play();
                } else {
                    onAudioPauseOrStop();
                }
            },
            onload: function() {
                if (audioTime) {
                    audioCurrentTime.innerText = "0:00";
                    audioDivider.innerText = "/";
                    audioLength.innerText = getTimeCodeFromNum(howler.duration());
                }
            },
            onloaderror: function(err) {
            	if (audioCurrentTime) {
            		audioCurrentTime.innerText = "Failed to load";
            	}
                console.log(err);
            },
            onvolume: function() {
                if (volumePercentage) {
                    volumePercentage.style.width = howler.volume() * 100 + '%';
                }
            }
        });

        howler.volume(parseFloat(dataSet.volume));

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
		
		playButton.parentElement.addEventListener("contextmenu", function(event) {
			event.preventDefault();
			// if file page opened, no need to open context menu
		    return !openFilePage();
		});

        // controls playing and pausing
        playButton.parentElement.addEventListener("click", function(event) {
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

        // controls volume button: either mute or unmute
        if (volumeButton) {
            volumeButton.addEventListener("click", function() {
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
            });
        }

        // controls volume slider
        if (volumeSlider) {
            volumeSlider.addEventListener('click', e => {
                const sliderWidth = window.getComputedStyle(volumeSlider).width;
                const newVolume = e.offsetX / parseInt(sliderWidth);
                howler.volume(newVolume);
            });
        }
    }

    async function audioInit() {
        // Safair doesn't support ogg opus. Use transcoded version if we see it.
        const oggSupported = await checkOggOpusSupport();
        if (!oggSupported) {
            fileExtensionUseTranscoded.ogg = true;
        }
        $(".audio-player").each(initAudioPlayer);
    }

    addScript("https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js", audioInit);
})();