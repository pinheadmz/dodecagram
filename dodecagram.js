/* eslint-env browser */
/* eslint "no-unused-vars": off */
'use strict';

class Synth {
  constructor() {
    this.ctx = new AudioContext();

    this.osc1 = this.ctx.createOscillator();
    this.osc1.frequency.value = 110;
    this.osc1.type = 'sine';

    this.osc2 = this.ctx.createOscillator();
    this.osc2.frequency.value = this.osc1.frequency.value * 2;
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

    this.out = this.ctx.createGain();
    this.out.gain.value = 0.1;

    this.osc1.connect(this.mxr, 0, 0);
    this.osc2.connect(this.mxr, 0, 1);
    this.lfo1.connect(this.lfoGain);
    this.lfoGain.connect(this.lpf.frequency);
    this.mxr.connect(this.lpf);
    this.lpf.connect(this.out);
    this.out.connect(this.ctx.destination);
  }

  start() {
    this.osc1.start(0);
    this.osc2.start(0);
    this.lfo1.start(0);
  }
}
