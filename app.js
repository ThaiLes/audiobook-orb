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
    analyser.smoothingTimeConstant = 0.25;

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
      const amplified = Math.pow(normalized, 1.3) * speechSensitivityMultiplier;
      return Math.min(1.0, amplified);
    }
  }

  // Fallback pattern simulation
  const speechCycle = 10;
  const position = time % speechCycle;
  if (position >= 7.5) return 0.0; // Complete silence pause

  const wave = Math.sin(time * 4.2) * 0.4 + Math.cos(time * 7.8) * 0.3 + 0.55;
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

  // Fast smooth response on spoken syllables, gentle exponential decay into silence[cite: 3]
  voiceLevel = smoothToward(voiceLevel, targetLevel, delta, targetLevel > voiceLevel ? 18.0 : 3.0);

  // When silence occurs, lightLevel hits 0.0, rendering all sphere optics completely invisible[cite: 3]
  body.style.setProperty("--light-level", voiceLevel.toFixed(4));

  orbFrame = requestAnimationFrame(animateOrb);
}

// Play / Pause Logic
playButton.addEventListener("click", async () => {
  setupWebAudio();

  if (audioCtx && audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  if (audioElement.paused) {
    audioElement.play().then(() => {
      isPlaying = true;
      if (actionIcon) actionIcon.textContent = "⏸";
    }).catch((err) => {
      console.warn("Audio play error:", err);
      isPlaying = true;
      if (actionIcon) actionIcon.textContent = "⏸";
    });
  } else {
    audioElement.pause();
    isPlaying = false;
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
  breathValue.textContent = duration >= 15 ? "Very slow" : duration >= 11 ? "Slow" : "Gentle";
});

// Launch loop
orbFrame = requestAnimationFrame(animateOrb);