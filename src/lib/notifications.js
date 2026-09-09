// Audio Context Singleton
let audioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Unlocks audio context on user interaction (tap / click / join) */
export function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
  } catch {}
}

/** Synthesizes a pleasant melodic chime (Airport / Luxury Hotel style) */
export function playTurnChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Melodic sequence: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.5)
    const notes = [
      { freq: 523.25, time: 0, duration: 0.35, gain: 0.35 },
      { freq: 659.25, time: 0.18, duration: 0.35, gain: 0.4 },
      { freq: 783.99, time: 0.36, duration: 0.45, gain: 0.45 },
      { freq: 1046.5, time: 0.58, duration: 0.8, gain: 0.5 },
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
  } catch (err) {
    console.warn("Audio chime playback error:", err);
  }
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

/** All-in-one trigger when turn arrives */
export function notifyCustomerTurn({ ticketNumber, businessName }) {
  // 1. Audio chime
  playTurnChime();

  // 2. Vibration
  vibratePhone();

  // 3. Browser system notification
  sendSystemNotification(`🎉 Ticket #${ticketNumber} — It's your turn!`, {
    body: `Please head over to ${businessName || "the counter"} now.`,
    tag: `turn-${ticketNumber}`,
  });
}
