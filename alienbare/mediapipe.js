// --- MediaPipe Setup ---

function onResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    gameState.handDetected = true;

    const hand = results.multiHandLandmarks[0];
    // Index Finger Tip is landmark 8
    const indexTip = hand[8];

    // Map Normalized Coordinates (0-1) to Three.js World Coordinates
    // Note: MP X is inverted relative to Three.js if we don't mirror.
    // Since we want it to act like a mirror, Left Hand side of screen = Left Side of World.
    // MP x: 0 (left) -> 1 (right).
    // Three x: -15 -> 15.

    // Inverting X because MP video is mirrored logic usually
    const x = (1 - indexTip.x) * 30 - 15;
    const y = (1 - indexTip.y) * 20 - 10;

    gameState.targetX = x;
    gameState.targetY = y;
  } else {
    gameState.handDetected = false;
  }
}

const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  },
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

hands.onResults(onResults);

const cameraUtils = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480,
});
