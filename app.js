"use strict";

const $ = (selector) => document.querySelector(selector);

const body = document.body;
const audioElement = $("#audiobookPlayer");
const playButton = $("#playButton");
const actionIcon = $("#actionIcon");
const settingsButton = $("#settingsButton");
const settingsDialog = $("#settingsDialog");
const closeSettings = $("#closeSettings");
const doneSettings = $("#doneSettings");

const speechIntensityInput = $("#speechIntensity");
const speechValue = $("#speechValue");
const flareIntensityInput = $("#flareIntensity");
const intensityValue = $("#intensityValue");
const breathSpeedInput = $("#breathSpeed");
const breathValue = $("#breathValue");

let isPlaying = false;
let voiceLevel = 0;
let previousOrbTime = null;
let orbFrame = null;
let speechSensitivityMultiplier = 1.0;

// Screen Wake Lock Handler (Prevents mobile display timeout)
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) {
    console.warn('Wake Lock error:', err);
  }
}

function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => { wakeLock = null; });
  }
}

document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible' && isPlaying) {
    await requestWakeLock();
  }
});

// Web Audio API Setup
let audioCtx = null;
let analyser = null;
let audioSource = null;
let dataArray = null;

function setupWebAudio() {
  if (audioCtx) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.35; // Soft organic transitions

    audioSource = audioCtx.createMediaElementSource(audioElement);
    audioSource.connect(analyser);
    analyser.connect(audioCtx.destination);

    dataArray = new Uint8Array(analyser.frequencyBinCount);
  } catch (err) {
    console.warn("Web Audio API setup:", err);
  }
}

function getVoiceSignal(time) {
  if (!isPlaying) return 0;

  if (analyser && dataArray) {
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 2; i < 40; i++) {
      sum += dataArray[i];
    }
    const avg = sum / 38;
    if (avg > 0) {
      const normalized = Math.max(0, (avg - 10) / 80);
      const amplified = Math.pow(normalized, 1.2) * speechSensitivityMultiplier;
      return Math.min(1.0, amplified);
    }
  }

  // Organic Fallback Cadence
  const speechCycle = 10;
  const position = time % speechCycle;
  if (position >= 7.5) return 0.0;

  const wave = Math.sin(time * 3.5) * 0.35 + Math.cos(time * 6.5) * 0.25 + 0.5;
  return Math.max(0.0, Math.min(1.0, wave * speechSensitivityMultiplier));
}

function smoothToward(current, target, delta, speed) {
  const amount = 1 - Math.exp(-delta * speed);
  return current + (target - current) * amount;
}

function animateOrb(timestamp) {
  if (previousOrbTime === null) previousOrbTime = timestamp;
  const delta = Math.min((timestamp - previousOrbTime) / 1000, 0.1);
  previousOrbTime = timestamp;
  const time = timestamp / 1000;

  const targetLevel = getVoiceSignal(time);

  // Controlled response rise/decay (never frantic)
  voiceLevel = smoothToward(voiceLevel, targetLevel, delta, targetLevel > voiceLevel ? 8.0 : 2.2);

  body.style.setProperty("--light-level", voiceLevel.toFixed(4));

  // Organic Colour Language: Shifts hue smoothly based on energy level
  // Deep Blue (0deg) -> Teal (25deg) -> Violet/Magenta (80deg) -> Amber Peak (110deg)
  let targetHue = 0;
  if (voiceLevel > 0.8) {
    targetHue = 110; // Amber/Peak accent
  } else if (voiceLevel > 0.55) {
    targetHue = 75;  // Violet/Magenta tension
  } else if (voiceLevel > 0.25) {
    targetHue = 25;  // Teal/Warmth connection
  } else {
    targetHue = 0;   // Deep Blue calm baseline
  }
  body.style.setProperty("--hue-shift", `${targetHue}deg`);

  orbFrame = requestAnimationFrame(animateOrb);
}

// Play / Pause Click Action
playButton.addEventListener("click", async () => {
  setupWebAudio();

  if (audioCtx && audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  if (audioElement.paused) {
    audioElement.play().then(() => {
      isPlaying = true;
      requestWakeLock();
      if (actionIcon) actionIcon.textContent = "⏸";
    }).catch((err) => {
      console.warn("Audio play error:", err);
      isPlaying = true;
      requestWakeLock();
      if (actionIcon) actionIcon.textContent = "⏸";
    });
  } else {
    audioElement.pause();
    isPlaying = false;
    releaseWakeLock();
    if (actionIcon) actionIcon.textContent = "▶";
  }
});

// Settings Dialog Actions
settingsButton.addEventListener("click", () => {
  if (typeof settingsDialog.showModal === "function") {
    settingsDialog.showModal();
  } else {
    settingsDialog.setAttribute("open", "true");
  }
});

function closeDialog() {
  if (typeof settingsDialog.close === "function") {
    settingsDialog.close();
  } else {
    settingsDialog.removeAttribute("open");
  }
}

closeSettings.addEventListener("click", closeDialog);
doneSettings.addEventListener("click", closeDialog);

speechIntensityInput.addEventListener("input", () => {
  speechSensitivityMultiplier = Number(speechIntensityInput.value) / 100;
  speechValue.textContent = `${speechIntensityInput.value}%`;
});

flareIntensityInput.addEventListener("input", () => {
  const mult = Number(flareIntensityInput.value) / 100;
  intensityValue.textContent = `${flareIntensityInput.value}%`;
  body.style.setProperty("--flare-multiplier", mult.toFixed(2));
});

breathSpeedInput.addEventListener("input", () => {
  const duration = Number(breathSpeedInput.value);
  body.style.setProperty("--breath-duration", `${duration}s`);
  breathValue.textContent = `Organic (${duration}s)`;
});

// Launch animation loop
orbFrame = requestAnimationFrame(animateOrb);