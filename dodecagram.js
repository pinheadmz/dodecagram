/* eslint-env browser */
/* eslint "no-unused-vars": off */
'use strict';

class Synth {
  constructor() {
    this.ctx = new AudioContext();

    this.basePitch = 55;
    this.osc1oct = 1;
    this.osc2oct = 2;

    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sine';

    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'sawtooth';

    this.lfo1 = this.ctx.createOscillator();
    this.lfo1.type = 'triangle';
    this.lfo1.frequency.value = 1.0;
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.value = 600;

    this.lpf  = this.ctx.createBiquadFilter();
    this.lpf.frequency.value = 1000;
    this.lpf.type = 'lowpass';

    this.mxr  = this.ctx.createChannelMerger(2);

    this.env = this.ctx.createGain();
    this.env.gain.value = 0;
    this.att = 0.01;
    this.hold = 0.3;
    this.rel = 4;

    this.out = this.ctx.createGain();
    this.out.gain.value = 0.1;

    this.osc1.connect(this.mxr, 0, 0);
    this.osc2.connect(this.mxr, 0, 1);
    this.lfo1.connect(this.lfoGain);
    this.lfoGain.connect(this.lpf.frequency);
    this.mxr.connect(this.lpf);
    this.lpf.connect(this.env);
    this.env.connect(this.out);
    this.out.connect(this.ctx.destination);
  }

  start() {
    this.osc1.start(0);
    this.osc2.start(0);
    this.lfo1.start(0);
  }

  hit(note) {
    const f = this.basePitch * (2 ** (note / 12));
    this.osc1.frequency.value = f * this.osc1oct;
    this.osc2.frequency.value = f * this.osc2oct;
    this.env.gain.linearRampToValueAtTime(1, this.att);
    this.env.gain.setTargetAtTime(0, this.hold, this.rel);
  }

  noteLength() {
    return this.att + this.hold + this.rel;
  }
}

class Star {
  constructor(canvas, window) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.window =  window;

    this.synth = null;
    this.centerX = 0;
    this.centerY = 0;
    this.r = 0;
    this.grd = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 0);

    window.addEventListener('resize', () => {
      this.resize();
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.click(
        e.pageX - this.canvas.offsetLeft,
        e.pageY - this.canvas.offsetTop
      );
    });

    this.resize();
  }

  resize() {
    const d = Math.min(window.innerHeight, window.innerWidth);
    this.canvas.height = d - 30;
    this.canvas.width = this.canvas.height;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
    this.r = (this.canvas.width / 2) - 4;

    // Gradient for point fill
    this.grd = this.ctx.createRadialGradient(0, 0, this.r / 4, 0, 0, this.r);
    this.grd.addColorStop(0, 'rgba(0, 0, 0, 0)');
    this.grd.addColorStop(1, 'rgba(250, 250, 0, 1)');

    this.draw();
  }

  draw() {
    // Outer circle
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = '#2d002f';
    this.ctx.fillStyle = 'black';
    this.ctx.beginPath();
    this.ctx.arc(this.centerX, this.centerY, this.r, 0, 2 * Math.PI);
    this.ctx.stroke();
    this.ctx.fill();

    // Star
    this.ctx.strokeStyle = '#ffff00';
    this.ctx.save();
    this.ctx.translate(this.centerX, this.centerY);
    for (let i = 1; i < 13; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0 + this.r);
      this.ctx.rotate(Math.PI - (Math.PI / 6));
      this.ctx.lineTo(0, 0 + this.r);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  bind(synth) {
    this.synth = synth;
  }

  click(x, y) {
    if (!this.synth)
      return;

    // Compute sector
    const opp = y - this.centerY;
    const adj = x - this.centerX;
    const angle = Math.atan2(opp, adj) * 180 / Math.PI;
    const note = (Math.round(angle / 180 * 6) + 15) % 12;

    // Fill point
    this.ctx.fillStyle = this.grd;
    this.ctx.save();
    this.ctx.translate(this.centerX, this.centerY);
    this.ctx.rotate(Math.PI + (Math.PI * (note + 6) / 6));
    this.ctx.beginPath();
    this.ctx.moveTo(0, 0 - this.r);
    this.ctx.arc(0, 0 - this.r, this.r, 5 * Math.PI / 12, 7 * Math.PI / 12);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();

    // Clear point after release
    setTimeout(
      () => {
        this.draw();
      },
      this.synth.noteLength() * 1000
    );

    // Play!
    this.synth.hit(note);
  }
}
