/** Short pleasant completion chime (Web Audio). */

export function playCelebrationChime() {
  if (typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();
    void ctx.resume().then(() => {
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.12, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      master.connect(ctx.destination);

      const freqs = [523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now + i * 0.08);
        g.gain.linearRampToValueAtTime(0.35, now + i * 0.08 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.35);
        osc.connect(g);
        g.connect(master);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.4);
      });

      setTimeout(() => ctx.close(), 2000);
    });
  } catch {
    // ignore
  }
}
