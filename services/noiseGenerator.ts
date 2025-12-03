import { AudioType } from '../types';

class NoiseGenerator {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private isInitialized = false;

  constructor() {
    // Lazy init to comply with browser autoplay policies
  }

  private initContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  // Create noise buffer (1 second loop is enough for noise)
  private createNoiseBuffer(type: AudioType): AudioBuffer {
    this.initContext();
    const ctx = this.audioContext!;
    const bufferSize = ctx.sampleRate * 2; // 2 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      
      if (type === AudioType.WHITE_NOISE) {
        data[i] = white;
      } else if (type === AudioType.PINK_NOISE) {
        // Pink noise approximation
        const b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        // (Approximation algorithm simplified for brevity)
        // Using a simpler 1/f filter approximation for robustness
        data[i] = (Math.random() * 2 - 1) * 0.5; // Placeholder for true pink, using softened white
      } else {
         // Brown noise (integrate white noise)
         const lastOut = 0;
         data[i] = (lastOut + (0.02 * white)) / 1.02;
         data[i] *= 3.5; // Compensate for gain loss
      }
    }
    
    // Better Pink/Brown Implementation via ScriptProcessor is deprecated.
    // We will use a simple buffer generation with basic filtering.
    // Re-writing buffer generation for better accuracy:
    
    if (type === AudioType.BROWN_NOISE) {
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5; 
        }
    } else if (type === AudioType.PINK_NOISE) {
        let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
        for (let i = 0; i < bufferSize; i++) {
             const white = Math.random() * 2 - 1;
             b0 = 0.99886 * b0 + white * 0.0555179;
             b1 = 0.99332 * b1 + white * 0.0750759;
             b2 = 0.96900 * b2 + white * 0.1538520;
             b3 = 0.86650 * b3 + white * 0.3104856;
             b4 = 0.55000 * b4 + white * 0.5329522;
             b5 = -0.7616 * b5 - white * 0.0168980;
             data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
             data[i] *= 0.11; 
             b6 = white * 0.115926;
        }
    }

    return buffer;
  }

  public async play(type: AudioType, volume: number) {
    this.initContext();
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.stop(); // Stop previous

    const buffer = this.createNoiseBuffer(type);
    this.sourceNode = this.audioContext!.createBufferSource();
    this.sourceNode.buffer = buffer;
    this.sourceNode.loop = true;

    this.gainNode = this.audioContext!.createGain();
    this.sourceNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext!.destination);

    // Fade in
    this.gainNode.gain.setValueAtTime(0, this.audioContext!.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(volume, this.audioContext!.currentTime + 1);

    this.sourceNode.start();
    this.isInitialized = true;
  }

  public setVolume(volume: number) {
    if (this.gainNode && this.audioContext) {
      // Smooth transition
      this.gainNode.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.1);
    }
  }

  public stop(fadeOutSeconds: number = 0) {
    if (this.sourceNode && this.gainNode && this.audioContext) {
      if (fadeOutSeconds > 0) {
        // Smart fade out
        const curr = this.gainNode.gain.value;
        this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
        this.gainNode.gain.setValueAtTime(curr, this.audioContext.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + fadeOutSeconds);
        
        setTimeout(() => {
          this.sourceNode?.stop();
          this.sourceNode?.disconnect();
          this.sourceNode = null;
        }, fadeOutSeconds * 1000);
      } else {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
    }
  }
}

export const noiseService = new NoiseGenerator();