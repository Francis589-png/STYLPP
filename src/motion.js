class MotionError extends Error {}
const finite = (n, name) => { if (!Number.isFinite(n)) throw new MotionError(`${name} must be finite`); return n; };

function clamp(v, min = 0, max = 1) {
  finite(v, 'value');
  finite(min, 'min');
  finite(max, 'max');
  if (min > max) throw new MotionError('min must be <= max');
  return Math.min(max, Math.max(min, v));
}
function easing(name, t) {
  t = clamp(t);
  if (name === 'linear') return t;
  if (name === 'ease-in') return t * t;
  if (name === 'ease-out') return 1 - (1 - t) ** 2;
  if (name === 'ease-in-out') return t < .5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  throw new MotionError(`Unknown easing: ${name}`);
}

class Tween {
  constructor({ from = 0, to = 1, duration = 0.25, easing: curve = 'ease-out' } = {}) {
    this.from = finite(from, 'from'); this.to = finite(to, 'to'); this.duration = finite(duration, 'duration');
    if (this.duration <= 0) throw new MotionError('duration must be > 0');
    this.curve = curve; this.elapsed = 0; this.done = false;
  }
  step(dt) {
    if (this.done) return this.to;
    dt = finite(dt, 'dt');
    if (dt < 0) throw new MotionError('dt must be >= 0');
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
    const value = this.from + (this.to - this.from) * easing(this.curve, this.elapsed / this.duration);
    if (this.elapsed >= this.duration) this.done = true;
    return value;
  }
  reset() { this.elapsed = 0; this.done = false; return this; }
}

class Timeline {
  constructor() { this.tracks = []; this.time = 0; this.duration = 0; this.playing = false; }
  add(tween, start = 0) {
    if (!(tween instanceof Tween)) throw new MotionError('timeline can only add Tween instances');
    start = finite(start, 'start'); if (start < 0) throw new MotionError('start must be >= 0');
    this.tracks.push({ tween, start }); this.duration = Math.max(this.duration, start + tween.duration); return this;
  }
  play() { this.playing = true; return this; }
  pause() { this.playing = false; return this; }
  seek(seconds) { seconds = finite(seconds, 'seconds'); this.time = clamp(seconds, 0, this.duration); return this; }
  step(dt) {
    if (!this.playing) return this.time;
    dt = finite(dt, 'dt');
    if (dt < 0) throw new MotionError('dt must be >= 0');
    this.time = Math.min(this.duration, this.time + dt);
    if (this.time >= this.duration) this.playing = false;
    return this.time;
  }
  sample() {
    return this.tracks.map(({ tween, start }) => ({
      value: tween.from + (tween.to - tween.from) * easing(tween.curve, clamp((this.time - start) / tween.duration)),
      active: this.time >= start && this.time <= start + tween.duration
    }));
  }
}

module.exports = { MotionError, clamp, easing, Tween, Timeline };
