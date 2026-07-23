/**
 * Text-to-speech for Ask Kloyya's answers — the browser's own SpeechSynthesis,
 * not a paid voice API (ElevenLabs, etc.). Same reasoning as speech-to-text:
 * ship the free, zero-dependency version now; a nicer voice is a later swap
 * behind this same function, not a reason to wait.
 */
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string): void {
  if (!canSpeak() || text.trim().length === 0) return;
  window.speechSynthesis.cancel(); // don't stack utterances
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
