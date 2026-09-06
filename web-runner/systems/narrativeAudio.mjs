let sharedAudioContext = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioContext) sharedAudioContext = new AudioContextClass();
  if (sharedAudioContext.state === 'suspended') sharedAudioContext.resume().catch(() => {});
  return sharedAudioContext;
}

export function playNarrativeAudioCue(cue) {
  const audioContext = getAudioContext();
  const notes = Array.isArray(cue?.notes) ? cue.notes : [];
  if (!audioContext || !notes.length) return false;
  let cursor = audioContext.currentTime;
  for (const note of notes) {
    const duration = Math.max(0.03, Number(note?.durationMs || 100) / 1000);
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = cue.waveform || 'sine';
    oscillator.frequency.setValueAtTime(Math.max(20, Number(note?.frequency || 220)), cursor);
    if (note?.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, Number(note.endFrequency)),
        cursor + duration,
      );
    }
    gain.gain.setValueAtTime(0.0001, cursor);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, Number(note?.gain || 0.06)), cursor + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, cursor + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(cursor);
    oscillator.stop(cursor + duration + 0.02);
    cursor += duration + Math.max(0, Number(note?.gapMs || 30) / 1000);
  }
  return true;
}
