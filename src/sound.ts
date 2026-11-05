export function playCompletionSound(enabled:boolean) {
  if(!enabled)return;
  try {
    const audio=new AudioContext(), oscillator=audio.createOscillator(), gain=audio.createGain();
    oscillator.connect(gain);gain.connect(audio.destination);
    oscillator.frequency.value=660;
    gain.gain.setValueAtTime(0.04,audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,audio.currentTime+0.2);
    oscillator.start();oscillator.stop(audio.currentTime+0.2);
    oscillator.onended=()=>{void audio.close();};
  }catch{/* Completion does not depend on audio availability. */}
}
