const WS_HOST = window.location.host;
import WebSocketManager from './socket.js';
const socket = new WebSocketManager(WS_HOST);

const cache = {};
let snowflakeIntervalId, snowflakeMode;

////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////// SETTINGS /////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

socket.sendCommand('getSettings', encodeURI(window.COUNTER_PATH));
socket.commands((data) => {
  try {
    const { command, message } = data;
    
    // Handle getSettings command
    if (command === 'getSettings') {
      console.log(command, message);
    }

    // Snowflake display mode
    if (cache.flakesmode !== message.FlakesMode) {
        cache.flakesmode = message.FlakesMode;
        if (cache.flakesmode === 'Mode icons') {
            snowflakeMode = 0;
        } else if (cache.flakesmode === '❄') {
            snowflakeMode = -1;
        }
    }

    // Snowflake scale
    if (cache.FlakesScale !== message.FlakesScale) {
        cache.FlakesScale = message.FlakesScale;
    }

    // Snowflake density
    if (cache.FlakesDensity !== message.FlakesDensity) {
        cache.FlakesDensity = message.FlakesDensity;
        refreshSnowflake();
    }

    // Snowflake falling speed multiplier    
    if (cache.FlakesFallingSpeed !== message.FlakesFallingSpeed) {
        cache.FlakesFallingSpeed = message.FlakesFallingSpeed;
    }

    // Snowflake spin speed multiplier
    if (cache.FlakesSpinVelocity !== message.FlakesSpinVelocity) {
        cache.FlakesSpinVelocity = message.FlakesSpinVelocity;
    }

    // Snowflake translational speed multiplier
    if (cache.FlakesTranslationalVelocity !== message.FlakesTranslationalVelocity) {
        cache.FlakesTranslationalVelocity = message.FlakesTranslationalVelocity;
    }

  } catch (error) {
    console.log(error);
  }
});

////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////// MAIN FUNCTION //////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

socket.api_v2((data) => {
    
    // Game mode update
    if (cache.beatmapMode !== data.settings.mode.number) {
        cache.beatmapMode = data.settings.mode.number;
        if (cache.flakesmode === 'Mode icons') {
            snowflakeMode = data.settings.mode.number;
        }
        refreshSnowflake();
    }

    // Skin update
    if (cache.skinFolder !== data.directPath.skinFolder) {
        cache.skinFolder = data.directPath.skinFolder;
        refreshSnowflake();
    }

},
[
    {
        field: 'settings',
        keys: [
          {
            field: 'mode',
            keys: ['number']
          }
        ]
    },
    {
        field: 'directPath',
        keys: ['skinFolder']
    }
]);

////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////// FUNCTIONS ////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

// Load image URL (returns a Promise, tries multiple URLs in order)
function urlFallback(urls) {
    return new Promise((resolve) => {
        let currentIndex = 0;
        const testImg = new Image();

        function tryLoadImage() {
            if (currentIndex >= urls.length) {
                resolve('');
                return;
            }
            testImg.src = urls[currentIndex];
            testImg.onload = () => resolve(testImg.src);
            testImg.onerror = () => {
                currentIndex++;
                tryLoadImage();
            };
        }
        tryLoadImage();
    });
}

// Check if skin image is available, return a valid image URL
function updateSkinImage(elementName, skinFolder) {
    let baseName = elementName.replace(/(@2x)?\.png$/i, '');
    let extMatch = elementName.match(/\.png$/i);
    if (!extMatch) return Promise.resolve('');
    let ext = extMatch[0];
    const urls = [
        `http://127.0.0.1:24050/files/skin/${baseName}@2x${ext}?skin=${encodeURIComponent(skinFolder)}`,
        `http://127.0.0.1:24050/files/skin/${baseName}${ext}?skin=${encodeURIComponent(skinFolder)}`
    ];
    return urlFallback(urls);
}

// Calculate snowflake spawn interval
function getSnowflakeInterval(screenWidth) {
    const baseWidth = 2560;
    const baseInterval = 50;
    // 获取密度倍率，默认100
    // Get density multiplier, default is 100
    const densityMultiplier = (cache.FlakesDensity ? cache.FlakesDensity : 100) / 100;
    return baseInterval * (baseWidth / screenWidth) / densityMultiplier;
}

// Create a snowflake DOM element
function createSnowflakeElement(options) {
    const snowflake = document.createElement('div');
    snowflake.classList.add('snowflake');
    document.getElementById('snowflakes').appendChild(snowflake);

    // Falling speed multiplier
    const speedMultiplier = (cache.FlakesFallingSpeed ? cache.FlakesFallingSpeed : 100) / 100;
    // Spin speed multiplier
    const spinMultiplier = (cache.FlakesSpinVelocity ? cache.FlakesSpinVelocity : 100) / 100;
    // Horizontal move speed multiplier
    const translationalMultiplier = (cache.FlakesTranslationalVelocity ? cache.FlakesTranslationalVelocity : 100) / 100;

    // Animation duration
    const baseHeight = 1440;
    const baseDuration = 6;
    const duration = baseDuration * (window.innerHeight / baseHeight) / speedMultiplier;
    snowflake.style.animationDuration = `${duration}s`;

    // Random initial horizontal speed (px/s) and acceleration (px/s²)
    const baseVx = (Math.random() * 50 + 50) * (Math.random() < 0.5 ? -1 : 1) * translationalMultiplier;
    const baseAx = (Math.random() * 10 - 10) * translationalMultiplier;

    // Calculate total horizontal movement: s = v0*t + 0.5*a*t^2
    const totalX = baseVx * duration + 0.5 * baseAx * duration * duration;
    snowflake.style.setProperty('--x', `${totalX}px`);

    // Use horizontal offset as spin direction, right is clockwise, left is counterclockwise
    const rotateDirection = totalX >= 0 ? 1 : -1;
    const rotateFactor = 3;
    const rotationDegree = Math.abs(totalX) * rotateFactor * spinMultiplier * rotateDirection;
    snowflake.style.setProperty('--rotate', `${rotationDegree}deg`);

    // Store initial speed and acceleration
    snowflake.dataset.vx = baseVx;
    snowflake.dataset.ax = baseAx;
    snowflake.dataset.duration = duration;

    // Remove snowflake after animation ends
    setTimeout(() => snowflake.remove(), duration * 1000);

    // Image snowflake
    if (options.type === 'image') {
        snowflake.style.backgroundImage = `url(${options.url})`;
        snowflake.style.backgroundSize = 'cover';
        snowflake.style.opacity = `${options.opacity}`;
        snowflake.style.width = `${options.width}px`;
        snowflake.style.height = `${options.height}px`;
        snowflake.style.top = `-${options.width}px`;

        // Center horizontally
        const left = Math.random() * window.innerWidth;
        snowflake.style.left = `${left - options.width / 2}px`;
    } else if (options.type === 'text') {
        // Text snowflake
        snowflake.textContent = '❄';
        snowflake.style.fontSize = `${options.size}px`;
        snowflake.style.color = 'white';
        snowflake.style.filter = `brightness(${options.brightness})`;
        snowflake.style.top = `-${options.size}px`;

        // Center horizontally
        const left = Math.random() * window.innerWidth;
        snowflake.style.left = `${left - options.size / 2}px`;
        snowflake.style.animation = `fall ${snowflake.style.animationDuration || '6s'} linear infinite`;
    }
}

// Generate a snowflake
function createSnowflake(url, mode) {
    // Get scale multiplier, default is 100
    const scaleMultiplier = (cache.FlakesScale ? cache.FlakesScale : 100) / 100;

    if (url) {
        // Use skin image
        const skinImg = new Image();
        skinImg.src = url;
        skinImg.onload = function() {
            const opacity = Math.random() * 0.8 + 0.2;
            let scale = (Math.random() * 0.8 + 0.2) * scaleMultiplier;
            if (url.includes('menu-snow@2x.png')) scale = scale / 2;
            const newWidth = scale * skinImg.width;
            const newHeight = scale * skinImg.height;
            createSnowflakeElement({
                type: 'image',
                url,
                opacity,
                width: newWidth,
                height: newHeight
            });
        };
    } else {
        // Use local image or text
        if ([0, 1, 2, 3].includes(mode)) {
            let localUrl = '';
            switch (mode) {
                case 0: localUrl = './assets/standard.png'; break;
                case 1: localUrl = './assets/taiko.png'; break;
                case 2: localUrl = './assets/catch.png'; break;
                case 3: localUrl = './assets/mania.png'; break;
            }
            const localImg = new Image();
            localImg.src = localUrl;
            localImg.onload = function() {
                const opacity = Math.random() * 0.8 + 0.2;
                let scale = (Math.random() * 0.8 + 0.2) * scaleMultiplier;
                const newWidth = scale * localImg.width;
                const newHeight = scale * localImg.height;
                createSnowflakeElement({
                    type: 'image',
                    url: localUrl,
                    opacity,
                    width: newWidth,
                    height: newHeight
                });
            };
        } else {
            // Text snowflake
            const brightness = Math.random() * 0.8 + 0.2;
            let size = (Math.random() * 30 + 20) * scaleMultiplier;
            createSnowflakeElement({
                type: 'text',
                size,
                brightness
            });
        }
    }
}

// Refresh snowflake spawn timer
function refreshSnowflake() {
    if (!cache.skinFolder) {
        return;
    }
    const snowflakeInterval = getSnowflakeInterval(window.innerWidth);
    updateSkinImage('menu-snow.png', cache.skinFolder)
        .then(validUrl => {
            if (snowflakeIntervalId) {
                clearInterval(snowflakeIntervalId);
            }
            snowflakeIntervalId = setInterval(() => createSnowflake(validUrl, snowflakeMode), snowflakeInterval);
        });
}
