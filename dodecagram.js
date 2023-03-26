/* eslint-env browser */
/* eslint "no-unused-vars": off */
'use strict';

const waveforms = {
  'sine':     '∿',
  'triangle': '△',
  'square':   '◻︎',
  'sawtooth': '∠'
};

const octaves = {
   1: '𝄢',
   2: '𝄡',
   3: '𝄞'
};

const modSpeeds = {
  min: 0,
  inc: 1
};

const filtFreqs = {
  min: 100,
  inc: 5
};

const knobs = {
  'MODSPEED': 0,
  'FILTFREQ': 1,
  'OSC': 2
};

class Osc {
  constructor(options) {
    this.ctx = options.ctx;
    this.osc = this.ctx.createOscillator();
    this.basef = 55; // root

    // Available settings
    this.waves = options.waves;
    this.octaves = [1, 2, 3];

    // Current selections
    this.wave = this.waves[0];
    this.octave = this.octaves[0];

    this.thick = options.thick || 0;
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
    this.osc.frequency.value = (f * this.octave) + this.thick;
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
      waves: ['sawtooth', 'triangle', 'square'],
      thick: 1
    });
    this.osc2.setWave(1);
    this.osc2.setOctave(1);

    this.lfo1 = this.ctx.createOscillator();
    this.lfo1.type = 'sine';
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.value = 100;

    this.lpf  = this.ctx.createBiquadFilter();
    this.lpf.type = 'lowpass';
    this.lpf.Q.value = 5;
    // this.lpf.frequency.value = 3700; // ? needed ?

    this.hpf  = this.ctx.createBiquadFilter();
    this.hpf.type = 'highpass';
    this.hpf.Q.value = 5;

    this.mxr  = this.ctx.createChannelMerger(2);

    this.env = this.ctx.createGain();
    this.env.gain.value = 0;
    this.att = 0.01;
    this.hold = 0.0;
    this.rel = 0.5;

    this.anal = this.ctx.createAnalyser();
    this.anal.minDecibels = -90;
    this.anal.maxDecibels = -10;
    this.anal.smoothingTimeConstant = 0.85;
    this.anal.fftSize = 2048;

    this.out = this.ctx.createGain();
    this.out.gain.value = 0.5;

    this.osc1.connect(this.mxr, 0, 0);
    this.osc2.connect(this.mxr, 0, 1);
    this.lfo1.connect(this.lfoGain);
    this.lfoGain.connect(this.lpf.frequency);
    this.mxr.connect(this.hpf);
    this.hpf.connect(this.lpf);
    this.lpf.connect(this.env);
    this.env.connect(this.anal);
    this.anal.connect(this.out);
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
  }

  release() {
    // https://developer.mozilla.org/en-US/docs/Web/API/
    //   AudioParam/setTargetAtTime#choosing_a_good_timeconstant
    this.env.gain.setTargetAtTime(0, this.att + this.hold, this.rel / 3);
  }
}

class Star {
  constructor(canvas, points, anal, window) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.points = points;
    this.pointsCtx = points.getContext('2d');

    this.anal = anal;
    this.analctx = this.anal.getContext('2d');
    this.analH = this.anal.height;
    this.analW = this.anal.width;

    this.window =  window;

    this.editMode = false;

    this.synth = null;
    this.centerX = 0;
    this.centerY = 0;
    this.r = 0;
    this.grd = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 0);

    this.analBuff = new Float32Array();
    this.drawAnalFrame = this.drawAnalFrame.bind(this);
    this.lastFrameTime = Date.now();

    // dodecarange 0-12
    this.modPos = 0;
    this.filtPos = 0;

    window.addEventListener('resize', () => {
      this.resize();
    });

    this.resize();
  }

  resize() {
    const d = Math.min(window.innerHeight, window.innerWidth);
    this.canvas.height = d - 30;
    this.canvas.width = this.canvas.height;
    this.points.height = this.canvas.height;
    this.points.width = this.canvas.height;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
    this.r = (this.canvas.width / 2) - 4;

    // Gradient for point fill
    this.grd = this.ctx.createRadialGradient(0, 0, this.r / 4, 0, 0, this.r);

    this.draw();
  }

  draw() {
    // reset
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Outer circle
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = '#2d002f';
    this.ctx.beginPath();
    this.ctx.arc(this.centerX, this.centerY, this.r, 0, 2 * Math.PI);
    this.ctx.stroke();

    // Star
    this.ctx.strokeStyle = '#ffff00';
    this.ctx.save();
    this.ctx.translate(this.centerX, this.centerY);
    for (let i = 1; i < 13; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, this.r);
      this.ctx.rotate(Math.PI - (Math.PI / 6));
      this.ctx.lineTo(0, this.r);
      this.ctx.stroke();
    }
    this.ctx.restore();

    // Modulation Speed
    {
      const pct = this.modPos / 12;
      this.ctx.strokeStyle = '#ff0000';
      this.ctx.save();
      this.ctx.translate(this.centerX, this.centerY);
      this.ctx.beginPath();
      this.ctx.rotate(pct * 2 * Math.PI);
      this.ctx.arc(0, 2 * this.r / -3, this.r / 16, 0, 2 * Math.PI);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Filter Cutoff Frequency
    {
      const pct = this.filtPos / 12;
      this.ctx.strokeStyle = '#0000ff';
      this.ctx.save();
      this.ctx.translate(this.centerX, this.centerY);
      this.ctx.beginPath();
      this.ctx.rotate(pct * 2 * Math.PI);
      this.ctx.arc(0, this.r / -2.75, this.r / 16, 0, 2 * Math.PI);
      this.ctx.stroke();
      this.ctx.restore();
    }

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
      this.ctx.fillText(symb, 0, this.r);
      this.ctx.rotate(Math.PI / 6);
    }

    this.ctx.restore();
  }

  bind(synth) {
    this.synth = synth;
    this.setModSpeed(this.modPos);
    this.setFiltFreq(this.filtPos);
    this.analBuff = new Float32Array(this.synth.anal.fftSize);
    this.drawAnalFrame();
  }

  toggleEditMode() {
    this.editMode = !this.editMode;
    this.draw();
  }

  orientation(e) {
    const {beta, gamma} = e;
    // eslint-disable-next-line no-nested-ternary
    const betaTrimmed = beta < 0
                        ? 0
                        : beta > 90
                          ? 90
                          : beta;
    // eslint-disable-next-line no-nested-ternary
    const gammaTrimmed = gamma < -90
                        ? 90
                        : gamma > 0
                          ? 0
                          : gamma;
    this.setModSpeed((betaTrimmed / 90) * 12);
    this.setFiltFreq((gammaTrimmed / 90) * 12);

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
    const dis = this.r / Math.sqrt(opp**2 + adj**2);

    // Center button
    if (dis > 3.75) {
      this.toggleEditMode();
      return;
    }

    // Knobs
    let knob = knobs.OSC;
    if (dis > 1.2)
      knob = knobs.MODSPEED;
    if (dis > 2.0)
      knob = knobs.FILTFREQ;

    const angle = Math.atan2(opp, adj) * 180 / Math.PI;
    if (this.editMode)
      this.selectOption(knob, angle);
    else
      this.selectNote((Math.round(angle / 180 * 6) + 15) % 12);
  }

  selectOption(knob, angle) {
    switch (knob) {
      case knobs.OSC: {
        const opt = (Math.ceil(angle / 180 * 6) + 14) % 12;
        this.setOsc(opt);
        break;
      }
      case knobs.MODSPEED: {
        const opt = (Math.round(angle / 180 * 6) + 15) % 12;
        this.setModSpeed(opt);
        break;
      }
      case knobs.FILTFREQ: {
        const opt = (Math.round(angle / 180 * 6) + 15) % 12;
        this.setFiltFreq(opt);
        break;
      }
      default: {
        break;
      }
    }

    this.draw();
  }

  setOsc(opt) {
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
  }

  setModSpeed(opt) {
    this.modPos = opt;
    if (this.synth) {
      const f = modSpeeds.min + (opt * modSpeeds.inc);
      this.synth.lfo1.frequency.linearRampToValueAtTime(f, 0.001);
    }
  }

  setFiltFreq(opt) {
    this.filtPos = opt;
    if (this.synth) {
      const f = filtFreqs.min + ((opt * filtFreqs.inc) ** 2);
      this.synth.hpf.frequency.linearRampToValueAtTime(f, 0.001);
    }
  }

  selectNote(note) {
    // Reset layer
    this.pointsCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.points.style.transition = 'opacity 0s';
    this.points.style.opacity = 1;

    // Fill point
    this.grd.addColorStop(0, 'rgba(0, 0, 0, 0)');
    this.grd.addColorStop(1, 'rgba(250, 250, 0, 1)');
    this.pointsCtx.fillStyle = this.grd;

    this.pointsCtx.save();
    this.pointsCtx.translate(this.centerX, this.centerY);
    this.pointsCtx.rotate(Math.PI + (Math.PI * (note + 6) / 6));
    this.pointsCtx.beginPath();
    this.pointsCtx.moveTo(0, 0 - this.r);
    this.pointsCtx.arc(
      0,
      0 - this.r,
      this.r,
      5 * Math.PI / 12,
      7 * Math.PI / 12
    );
    this.pointsCtx.closePath();
    this.pointsCtx.fill();
    this.pointsCtx.restore();

    // Play!
    this.synth.hit(note);
  }

  release() {
    if (this.editMode)
      return;

    // fade out point for release time, after hold time
    if (this.timeout)
      clearTimeout(this.timeout);
    this.synth.release();
    this.timeout = setTimeout(() => {
      this.points.style.transition = `opacity ${this.synth.rel * 5}s`;
      this.points.style.opacity = 0;
    }, this.synth.hold * 1000);
  }

  drawAnalFrame() {
    requestAnimationFrame(this.drawAnalFrame);

    this.synth.anal.getFloatTimeDomainData(this.analBuff);

    this.analctx.fillStyle = '#000000';
    this.analctx.fillRect(0, 0, this.analW, this.analH);

    this.analctx.lineWidth = 2;
    this.analctx.strokeStyle = '#f000f0';

    this.analctx.beginPath();

    const wavelength = this.analBuff.length;

    const sliceWidth = this.analW / wavelength;
    let x = 0;

    for (let i = 0; i < wavelength; i++) {
      const v = this.analBuff[i];
      const y = ((v * this.analH) * 0.3) + (this.analH / 2);

      if (i === 0) {
        this.analctx.moveTo(x, y);
      } else {
        this.analctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    this.analctx.lineTo(this.analW, this.analH / 2);
    this.analctx.stroke();
  }
}
