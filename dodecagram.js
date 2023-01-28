/* eslint-env browser */
/* eslint "no-unused-vars": off */
'use strict';

const waveforms = {
  'sine':     '∿',
  'triangle': '△',
  'square':   '◻︎',
  'sawtooth': '⩘'
};

const octaves = {
   1: '𝄢',
   2: '𝄡',
   4: '𝄞'
};

class Osc {
  constructor(options) {
    this.ctx = options.ctx;
    this.osc = this.ctx.createOscillator();
    this.basef = 110; // root

    // Available settings
    this.waves = options.waves;
    this.octaves = [1, 2, 4];

    // Current selections
    this.wave = this.waves[0];
    this.octave = this.octaves[0];
  }

  setWave(n) {
    this.wave = this.waves[n % this.waves.length];
    this.osc.type = this.wave;
  }

  setOctave(n) {
    this.octave = this.octaves[n % this.octaves.length];
  }

  setNote(note) {
    const f = this.basef * (2 ** (note / 12));
    this.osc.frequency.value = f * this.octave;
  }

  connect(dest, output, input) {
    this.osc.connect(dest, output, input);
  }

  start(when) {
    this.osc.start(when);
  }

  getOptions() {
    const list = [];
    for (const wave of this.waves)
      list.push([waveforms[wave], this.wave === wave]);
    for (const octave of this.octaves)
      list.push([octaves[octave], this.octave === octave]);

    return list;
  }
}

class Synth {
  constructor() {
    this.ctx = new AudioContext();

    this.basePitch = 55;

    this.osc1 = new Osc({
      ctx: this.ctx,
      waves: ['sine', 'triangle', 'square']
    });
    this.osc2 = new Osc({
      ctx: this.ctx,
      waves: ['sawtooth', 'triangle', 'square']
    });

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
    this.rel = 0.5;

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
    this.osc1.setNote(note);
    this.osc2.setNote(note);
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

    this.editMode = false;

    this.synth = null;
    this.centerX = 0;
    this.centerY = 0;
    this.r = 0;
    this.grd = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 0);

    window.addEventListener('resize', () => {
      this.resize();
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
    // reset
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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

    if (this.editMode)
      this.drawEditMode();
  }

  drawEditMode() {
    const fontsize = this.canvas.height / 20;
    this.ctx.font = `${fontsize}px monospace`;
    this.ctx.fillStyle = 'white';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Osc. 1', 0, fontsize);
    this.ctx.textAlign = 'right';
    this.ctx.fillText('Osc. 2', this.canvas.width, fontsize);
    this.ctx.textAlign = 'center';

    this.ctx.save();
    this.ctx.translate(this.centerX, this.centerY);
    this.ctx.rotate(Math.PI / 12);

    const opts = this.synth.osc1.getOptions()
                 .concat(this.synth.osc2.getOptions().reverse());
    for (const [symb, selected] of opts) {
      if (selected) {
        this.ctx.font = `${fontsize * 2}px bold monospace`;
        this.ctx.fillStyle = 'green';
      } else {
        this.ctx.font = `${fontsize}px monospace`;
        this.ctx.fillStyle = 'white';
      }
      this.ctx.fillText(symb, 0, 0 + this.r);
      this.ctx.rotate(Math.PI / 6);
    }

    this.ctx.restore();
  }

  bind(synth) {
    this.synth = synth;
  }

  toggleEditMode() {
    this.editMode = !this.editMode;
    this.draw();
  }

  click(e) {
    if (!this.synth)
      return;

    const x = e.pageX - this.canvas.offsetLeft;
    const y = e.pageY - this.canvas.offsetTop;

    // Compute distance from center
    const opp = y - this.centerY;
    const adj = x - this.centerX;
    const dis = Math.sqrt(opp**2 + adj**2);

    // Center button
    if (dis < this.r / 4) {
      this.toggleEditMode();
      return;
    }

    const angle = Math.atan2(opp, adj) * 180 / Math.PI;
    if (this.editMode)
      this.selectOption((Math.ceil(angle / 180 * 6) + 14) % 12);
    else
      this.selectNote((Math.round(angle / 180 * 6) + 15) % 12);
  }

  selectOption(opt) {
    const osc = opt < 6
                ? this.synth.osc2
                : this.synth.osc1;
    const sel = opt > 5
                ? opt - 6
                : 5 - opt;

    if (sel < 3)
      osc.setWave(sel);
    else
      osc.setOctave(sel - 3);

    this.draw();
  }

  selectNote(note) {
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
