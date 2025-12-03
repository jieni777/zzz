export enum AudioType {
  BROWN_NOISE = 'Deep Sleep',
  PINK_NOISE = 'Rain Mood',
  WHITE_NOISE = 'Static'
}

export enum StoryMood {
  RELAXING = 'Relaxing',
  FANTASY = 'Fantasy',
  NATURE = 'Nature',
  SPACE = 'Space'
}

export interface StoryConfig {
  mood: StoryMood;
  topic: string;
}

export interface AudioState {
  isPlaying: boolean;
  envVolume: number; // 0.0 to 1.0
  voiceVolume: number; // 0.0 to 1.0
  selectedNoise: AudioType;
  timerMinutes: number;
  remainingSeconds: number | null;
}

export type Tab = 'STORY' | 'AMBIENCE';