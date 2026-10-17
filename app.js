"use strict";

const $ = (selector) => document.querySelector(selector);

const canvas = $("#orbCanvas");
const ctx = canvas.getContext("2d");

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
let speechSensitivityMultiplier = 1.0;
let baseBrightnessCeiling = 1.0;
let breathCycleDuration = 5.0;

// Screen Wake Lock
let wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch (err) { console.warn('Wake Lock error:', err); }
}
function releaseWakeLock() {
  if (wakeLock !== null) { wakeLock.release().then(() => { wakeLock = null; }); }
}

// Web Audio API
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
    analyser.smoothingTimeConstant = 0.35;

    audioSource = audioCtx.createMediaElementSource(audioElement);
    audioSource.connect(analyser);
    analyser.connect(audioCtx.destination);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
  } catch (err) { console.warn("Web Audio API setup:", err); }
}

function getVoiceSignal(time) {
  if (!isPlaying) return 0;
  if (analyser && dataArray) {
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 2; i < 40; i++) sum += dataArray[i];
    const avg = sum / 38;
    if (avg > 0) {
      const normalized = Math.max(0, (avg - 10) / 80);
      return Math.min(1.0, Math.pow(normalized, 1.2) * speechSensitivityMultiplier);
    }
  }
  const position = time % 10;
  if (position >= 7.5) return 0.0;
  const wave = Math.sin(time * 3.5) * 0.35 + Math.cos(time * 6.5) * 0.25 + 0.5;
  return Math.max(0.0, Math.min(1.0, wave * speechSensitivityMultiplier));
}

function smoothToward(current, target, delta, speed) {
  return current + (target - current) * (1 - Math.exp(-delta * speed));
}

// Draw Procedural Orb
function drawProceduralOrb(time, voice) {
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;

  ctx.clearRect(0, 0, width, height);

  // Silence becomes pitch black
  if (voice <= 0.001) return;

  const globalAlpha = Math.min(1.0, voice * baseBrightnessCeiling);
  ctx.save();
  ctx.globalAlpha = globalAlpha;

  // Independent Breathing Radius
  const breathScale = 1.0 + Math.sin((time * Math.PI * 2) / breathCycleDuration) * 0.05;
  const baseRadius = 180 * breathScale;

  // Color Palette Interpolation
  let coreColor = "rgba(0, 240, 255, ";
  let edgeColor = "rgba(142, 36, 170, ";
  if (voice > 0.8) {
    coreColor = "rgba(255, 109, 0, ";  // Amber Peak
    edgeColor = "rgba(255, 235, 59, ";
  } else if (voice > 0.5) {
    coreColor = "rgba(142, 36, 170, "; // Violet Tension
    edgeColor = "rgba(0, 240, 255, ";
  } else if (voice > 0.25) {
    coreColor = "rgba(0, 229, 163, ";  // Teal Warmth
    edgeColor = "rgba(8, 16, 38, ";
  }

  // 1. Core Energy Glow
  const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 0.8);
  coreGlow.addColorStop(0, coreColor + "0.9)");
  coreGlow.addColorStop(0.4, coreColor + "0.35)");
  coreGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = coreGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 0.8, 0, Math.PI * 2);
  ctx.fill();

  // 2. Living Weave Filaments
  ctx.lineWidth = 1.5;
  const strandCount = 12;
  for (let i = 0; i < strandCount; i++) {
    const angle = (i / strandCount) * Math.PI * 2 + time * 0.2;
    const waveOffset = Math.sin(time * 2 + i) * 25;
    
    ctx.strokeStyle = (i % 2 === 0 ? coreColor : edgeColor) + "0.45)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);

    const cp1x = cx + Math.cos(angle - 0.5) * (baseRadius * 0.5) + waveOffset;
    const cp1y = cy + Math.sin(angle - 0.5) * (baseRadius * 0.5);
    const endX = cx + Math.cos(angle) * (baseRadius * 0.92);
    const endY = cy + Math.sin(angle) * (baseRadius * 0.92);

    ctx.quadraticCurveTo(cp1x, cp1y, endX, endY);
    ctx.stroke();

    // Node Sparkles
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(endX, endY, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Translucent Shell Edge Boundary
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
  ctx.shadowColor = "rgba(0, 240, 255, 0.8)";
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 4. Horizontal Anamorphic Lens Flare
  const flareWidth = baseRadius * (1.2 + voice * 0.8);
  const flareGradient = ctx.createLinearGradient(cx - flareWidth, cy, cx + flareWidth, cy);
  flareGradient.addColorStop(0, "rgba(0, 240, 255, 0)");
  flareGradient.addColorStop(0.45, "rgba(0, 240, 255, 0.8)");
  flareGradient.addColorStop(0.5, "#ffffff");
  flareGradient.addColorStop(0.55, "rgba(0, 240, 255, 0.8)");
  flareGradient.addColorStop(1, "rgba(0, 240, 255, 0)");

  ctx.fillStyle = flareGradient;
  ctx.fillRect(cx - flareWidth, cy - 1.5, flareWidth * 2, 3);

  // 5. White Hot Center Origin Point
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function animateOrb(timestamp) {
  if (previousOrbTime === null) previousOrbTime = timestamp;
  const delta = Math.min((timestamp - previousOrbTime) / 1000, 0.1);
  previousOrbTime = timestamp;
  const time = timestamp / 1000;

  const targetLevel = getVoiceSignal(time);
  voiceLevel = smoothToward(voiceLevel, targetLevel, delta, targetLevel > voiceLevel ? 8.0 : 2.2);

  drawProceduralOrb(time, voiceLevel);
  requestAnimationFrame(animateOrb);
}

// Event Listeners & Controls
playButton.addEventListener("click", async () => {
  setupWebAudio();
  if (audioCtx && audioCtx.state === "suspended") await audioCtx.resume();

  if (audioElement.paused) {
    audioElement.play().then(() => {
      isPlaying = true;
      requestWakeLock();
      if (actionIcon) actionIcon.textContent = "⏸";
    }).catch(() => {
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

settingsButton.addEventListener("click", () => {
  if (typeof settingsDialog.showModal === "function") settingsDialog.showModal();
  else settingsDialog.setAttribute("open", "true");
});

function closeDialog() {
  if (typeof settingsDialog.close === "function") settingsDialog.close();
  else settingsDialog.removeAttribute("open");
}

closeSettings.addEventListener("click", closeDialog);
doneSettings.addEventListener("click", closeDialog);

speechIntensityInput.addEventListener("input", () => {
  speechSensitivityMultiplier = Number(speechIntensityInput.value) / 100;
  speechValue.textContent = `${speechIntensityInput.value}%`;
});

flareIntensityInput.addEventListener("input", () => {
  baseBrightnessCeiling = Number(flareIntensityInput.value) / 100;
  intensityValue.textContent = `${flareIntensityInput.value}%`;
});

breathSpeedInput.addEventListener("input", () => {
  breathCycleDuration = Number(breathSpeedInput.value);
  breathValue.textContent = `Organic (${breathCycleDuration}s)`;
});

requestAnimationFrame(animateOrb);