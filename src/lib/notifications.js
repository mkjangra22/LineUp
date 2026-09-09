// Audio Context & Audio Element Singleton
let audioCtx = null;
let chimeAudioEl = null;

// Generate a 1.2-second 4-tone airport chime WAV as a base64 Data URL
function generateChimeWavDataUrl() {
  const sampleRate = 22050;
  const duration = 1.3;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples * 2, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numSamples * 2, true);

  // Chime notes: C5 (523Hz), E5 (659Hz), G5 (783Hz), C6 (1046Hz)
  const notes = [
    { freq: 523.25, start: 0.0, end: 0.35, amp: 0.4 },
    { freq: 659.25, start: 0.18, end: 0.55, amp: 0.45 },
    { freq: 783.99, start: 0.36, end: 0.8, amp: 0.5 },
    { freq: 1046.5, start: 0.58, end: 1.3, amp: 0.55 },
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sampleVal = 0;

    for (const note of notes) {
      if (t >= note.start && t <= note.end) {
        const noteTime = t - note.start;
        const noteDuration = note.end - note.start;
        const envelope = Math.exp(-3.5 * (noteTime / noteDuration));
        sampleVal += Math.sin(2 * Math.PI * note.freq * noteTime) * note.amp * envelope;
      }
    }

    sampleVal = Math.max(-1, Math.min(1, sampleVal));
    view.setInt16(44 + i * 2, sampleVal * 32767, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return "data:audio/wav;base64," + btoa(binary);
}

function getAudioElement() {
  if (typeof window === "undefined") return null;
  if (!chimeAudioEl) {
    try {
      chimeAudioEl = new Audio(generateChimeWavDataUrl());
      chimeAudioEl.preload = "auto";
    } catch {}
  }
  return chimeAudioEl;
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

let isUnlocked = false;

/** Silently unlocks Web Audio Context on first user tap (NO SOUND PRODUCED) */
export function unlockAudio() {
  if (isUnlocked) return;
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      // Play a completely silent 0-sample buffer (inaudible)
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      isUnlocked = true;
    }
  } catch {}
}

/** Plays the turn chime ONLY when called (when turn arrives) */
export function playTurnChime() {
  // 1. Try Web Audio API
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, time: 0, duration: 0.35, gain: 0.4 },
        { freq: 659.25, time: 0.18, duration: 0.35, gain: 0.45 },
        { freq: 783.99, time: 0.36, duration: 0.45, gain: 0.5 },
        { freq: 1046.5, time: 0.58, duration: 0.8, gain: 0.55 },
      ];

      notes.forEach(({ freq, time, duration, gain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + time);

        gainNode.gain.setValueAtTime(0.001, now + time);
        gainNode.gain.exponentialRampToValueAtTime(gain, now + time + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now + time);
        osc.stop(now + time + duration);
      });
    }
  } catch (err) {
    console.warn("Web Audio chime error:", err);
  }

  // 2. Fallback to HTML5 audio element
  try {
    const el = getAudioElement();
    if (el) {
      el.currentTime = 0;
      el.volume = 1;
      el.play().catch(() => {});
    }
  } catch {}
}

/** Vibrates phone with a distinct double-buzz pattern */
export function vibratePhone() {
  try {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([300, 120, 300, 120, 600]);
    }
  } catch {}
}

/** Requests browser notification permission */
export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return "denied";
  }
}

/** Sends a system notification if permitted */
export function sendSystemNotification(title, options = {}) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      const notif = new Notification(title, {
        icon: "/LineUp(Logo).png",
        badge: "/LineUp(Logo).png",
        vibrate: [300, 100, 300],
        ...options,
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch {}
  }
}

// Screen Wake Lock Singleton
let wakeLockSentinel = null;

/** Requests Screen Wake Lock to prevent mobile phone from sleeping/locking */
export async function requestWakeLock() {
  if (typeof window === "undefined" || !("wakeLock" in navigator)) {
    return false;
  }
  try {
    if (!wakeLockSentinel || wakeLockSentinel.released) {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", () => {
        wakeLockSentinel = null;
      });
    }
    return true;
  } catch {
    return false;
  }
}

/** Releases the Screen Wake Lock when ticket is closed or left */
export async function releaseWakeLock() {
  try {
    if (wakeLockSentinel) {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    }
  } catch {}
}

/** All-in-one trigger when turn arrives */
export function notifyCustomerTurn({ ticketNumber, businessName }) {
  // 1. Audio chime (ONLY plays here!)
  playTurnChime();

  // 2. Vibration
  vibratePhone();

  // 3. Browser system notification
  sendSystemNotification(`🎉 Ticket #${ticketNumber} — It's your turn!`, {
    body: `Please head over to ${businessName || "the counter"} now.`,
    tag: `turn-${ticketNumber}`,
  });
}
