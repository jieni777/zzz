import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GlassContainer } from './components/GlassContainer';
import { Typewriter } from './components/Typewriter';
import { noiseService } from './services/noiseGenerator';
import { generateSleepStory } from './services/geminiService';
import { AudioType, StoryMood, StoryConfig, Tab } from './types';
import { 
  PlayIcon, 
  PauseIcon, 
  SpeakerWaveIcon, 
  MoonIcon, 
  BookOpenIcon, 
  MusicalNoteIcon, 
  SparklesIcon, 
  ClockIcon 
} from '@heroicons/react/24/solid';

// --- Helper Components (Defined internally for single-file coherence in logic) ---

const VolumeSlider = ({ value, onChange, label, icon: Icon }: any) => (
  <div className="flex items-center space-x-4 w-full">
    <Icon className="w-5 h-5 text-duck-text/70" />
    <div className="flex-1">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-duck-text/50">{label}</span>
        <span className="text-xs text-duck-text/50">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  </div>
);

const Chip = ({ label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border ${
      active 
        ? 'bg-duck-accent/20 border-duck-accent text-duck-accent shadow-[0_0_10px_rgba(56,189,248,0.3)]' 
        : 'bg-transparent border-duck-glassBorder text-duck-text/60 hover:bg-white/5'
    }`}
  >
    {label}
  </button>
);

// --- Main Component ---

const App: React.FC = () => {
  // --- State ---
  const [activeTab, setActiveTab] = useState<Tab>('STORY');
  const [isPlaying, setIsPlaying] = useState(false);
  const [envVolume, setEnvVolume] = useState(0.5);
  const [voiceVolume, setVoiceVolume] = useState(0.8);
  const [selectedNoise, setSelectedNoise] = useState<AudioType>(AudioType.PINK_NOISE);
  
  // Timer State
  const [timerDuration, setTimerDuration] = useState(15); // Minutes
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Story State
  const [storyConfig, setStoryConfig] = useState<StoryConfig>({ mood: StoryMood.RELAXING, topic: '' });
  const [storyText, setStoryText] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasStartedStory, setHasStartedStory] = useState(false);

  // Refs for TTS
  const synth = useRef<SpeechSynthesis>(window.speechSynthesis);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  // --- Logic: Timer ---
  
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRemainingTime(timerDuration * 60);
  }, [timerDuration]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRemainingTime(null);
  }, []);

  useEffect(() => {
    if (remainingTime !== null && isPlaying) {
      timerRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev === null || prev <= 0) {
            // Timer Finished - Smart Fade Out
            handleStop(true); // true = smooth fade out
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [remainingTime, isPlaying]);

  // --- Logic: Audio Control ---

  const handlePlay = async () => {
    if (isPlaying) {
      handleStop(false);
      return;
    }

    // 1. Start Noise
    try {
      await noiseService.play(selectedNoise, envVolume);
    } catch (e) {
      console.error("Audio Context blocked?", e);
    }

    // 2. Start Story (if text exists)
    if (storyText) {
      speakStory(storyText);
    } else if (!hasStartedStory) {
       // If no story yet, just play noise is fine, but maybe trigger gen?
       // For now, let's assume user generates first.
    }

    // 3. Start Timer
    startTimer();
    setIsPlaying(true);
  };

  const handleStop = (fadeOut: boolean) => {
    setIsPlaying(false);
    stopTimer();

    if (fadeOut) {
      // Fade out noise
      noiseService.stop(3); // 3s fade out
      
      // Fade out TTS (Simulated by cancelling, as WebSpeech API doesn't support volume fade natively easily)
      // We will just stop TTS for now, or we could try to interval down the volume.
      // WebSpeech API volume change doesn't work mid-utterance on all browsers. 
      // We'll just stop it gently after a delay or immediately.
      setTimeout(() => {
          synth.current.cancel();
      }, 3000); 
    } else {
      noiseService.stop(0);
      synth.current.cancel();
    }
  };

  const speakStory = (text: string) => {
    synth.current.cancel(); // Clear queue
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.85; // Slower for sleep
    u.pitch = 0.9; // Lower pitch
    u.volume = voiceVolume;
    
    // Find a good Chinese voice
    const voices = synth.current.getVoices();
    const zhVoice = voices.find(v => v.lang === 'zh-CN' && !v.name.includes('Google')); // Try system voice first or specific
    if (zhVoice) u.voice = zhVoice;

    u.onend = () => {
       // Loop story? Or just silence. White paper says stop at timer.
    };

    utterance.current = u;
    synth.current.speak(u);
  };

  // --- Logic: Generation ---

  const handleGenerate = async () => {
    setIsGenerating(true);
    setStoryText(""); 
    setHasStartedStory(true);
    
    const story = await generateSleepStory(storyConfig);
    setStoryText(story);
    setIsGenerating(false);
  };

  // --- Effects ---

  // Update noise volume in real-time
  useEffect(() => {
    noiseService.setVolume(envVolume);
  }, [envVolume]);

  // Update TTS volume - Note: only applies to NEXT utterance usually, unless we restart
  useEffect(() => {
    if (utterance.current) {
      utterance.current.volume = voiceVolume;
    }
  }, [voiceVolume]);

  // Handle noise type change while playing
  useEffect(() => {
    if (isPlaying) {
      noiseService.play(selectedNoise, envVolume);
    }
  }, [selectedNoise]);

  // Format Timer
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col animate-breathe text-duck-text selection:bg-duck-accent/30">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] animate-pulse-slow" style={{animationDelay: '2s'}}></div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 p-6 flex flex-col max-w-lg mx-auto w-full h-screen overflow-hidden">
        
        {/* Header */}
        <header className="flex justify-between items-center py-4 mb-2">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-full bg-duck-accent/20 flex items-center justify-center border border-duck-accent/30">
                <MoonIcon className="w-5 h-5 text-duck-accent" />
             </div>
             <h1 className="text-xl font-bold tracking-tight text-white/90">South Duck</h1>
          </div>
          <div className="text-xs font-mono text-duck-text/40 border border-white/10 px-2 py-1 rounded-md">
            v1.0
          </div>
        </header>

        {/* Dynamic Content Switcher */}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-32">
          {activeTab === 'STORY' && (
            <div className="space-y-6 animate-fade-in">
              {/* Story Generator Card */}
              <GlassContainer className="p-6">
                <h2 className="text-sm font-semibold text-duck-text/70 mb-4 flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4" /> AI STORY GENERATOR
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-duck-text/50 mb-2 block">MOOD</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.values(StoryMood).map(m => (
                        <Chip 
                          key={m} 
                          label={m} 
                          active={storyConfig.mood === m} 
                          onClick={() => setStoryConfig({...storyConfig, mood: m})} 
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-duck-text/50 mb-2 block">TOPIC (OPTIONAL)</label>
                    <input 
                      type="text" 
                      placeholder="e.g., A walk in the autumn forest..."
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-duck-accent/50 transition-colors"
                      value={storyConfig.topic}
                      onChange={(e) => setStoryConfig({...storyConfig, topic: e.target.value})}
                    />
                  </div>

                  <button 
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full bg-duck-accent hover:bg-duck-accent/90 text-duck-slate font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <span className="animate-pulse">Dreaming...</span>
                    ) : (
                      <>Generate Story <SparklesIcon className="w-4 h-4" /></>
                    )}
                  </button>
                </div>
              </GlassContainer>

              {/* Story Display */}
              {(storyText || isGenerating) && (
                <GlassContainer className="p-6 min-h-[200px]">
                   {isGenerating ? (
                     <div className="flex items-center justify-center h-32 text-duck-text/30 animate-pulse">
                        Listening to the stars...
                     </div>
                   ) : (
                     <Typewriter text={storyText} speed={50} />
                   )}
                </GlassContainer>
              )}
            </div>
          )}

          {activeTab === 'AMBIENCE' && (
            <div className="space-y-6 animate-fade-in">
              <GlassContainer className="p-6">
                 <h2 className="text-sm font-semibold text-duck-text/70 mb-4 flex items-center gap-2">
                  <MusicalNoteIcon className="w-4 h-4" /> WHITE NOISE
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {Object.values(AudioType).map((type) => (
                    <div 
                      key={type}
                      onClick={() => setSelectedNoise(type)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        selectedNoise === type 
                        ? 'bg-duck-accent/10 border-duck-accent/50' 
                        : 'bg-white/5 border-transparent hover:bg-white/10'
                      }`}
                    >
                      <span className="font-medium text-sm">{type}</span>
                      {selectedNoise === type && <div className="w-2 h-2 rounded-full bg-duck-accent shadow-[0_0_8px_#38bdf8]"></div>}
                    </div>
                  ))}
                </div>
              </GlassContainer>

               <GlassContainer className="p-6">
                  <h2 className="text-sm font-semibold text-duck-text/70 mb-4 flex items-center gap-2">
                    <ClockIcon className="w-4 h-4" /> SLEEP TIMER
                  </h2>
                  <div className="mb-4 text-center">
                    <span className="text-4xl font-light text-duck-accent">
                      {remainingTime !== null ? formatTime(remainingTime) : `${timerDuration} min`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={timerDuration}
                    disabled={isPlaying && remainingTime !== null}
                    onChange={(e) => setTimerDuration(parseInt(e.target.value))}
                    className="mb-2"
                  />
                  <div className="flex justify-between text-xs text-duck-text/40 px-1">
                    <span>5m</span>
                    <span>60m</span>
                  </div>
               </GlassContainer>
            </div>
          )}
        </div>

        {/* Bottom Floating Control Panel */}
        <div className="absolute bottom-6 left-6 right-6 z-50">
           <GlassContainer className="p-4 shadow-2xl shadow-black/50 backdrop-blur-2xl bg-duck-slate/80 border-duck-glassBorder">
              {/* Mixer Sliders */}
              <div className="space-y-3 mb-4 border-b border-white/5 pb-4">
                 <VolumeSlider 
                    value={voiceVolume} 
                    onChange={setVoiceVolume} 
                    label="Voice (Story)" 
                    icon={BookOpenIcon}
                  />
                 <VolumeSlider 
                    value={envVolume} 
                    onChange={setEnvVolume} 
                    label="Environment" 
                    icon={SpeakerWaveIcon}
                  />
              </div>

              {/* Play Controls */}
              <div className="flex items-center justify-between">
                 <div className="flex gap-4">
                    <button 
                      onClick={() => setActiveTab('STORY')}
                      className={`p-2 rounded-lg transition-colors ${activeTab === 'STORY' ? 'text-duck-accent bg-white/10' : 'text-duck-text/40 hover:text-white'}`}
                    >
                      <BookOpenIcon className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={() => setActiveTab('AMBIENCE')}
                      className={`p-2 rounded-lg transition-colors ${activeTab === 'AMBIENCE' ? 'text-duck-accent bg-white/10' : 'text-duck-text/40 hover:text-white'}`}
                    >
                      <MusicalNoteIcon className="w-6 h-6" />
                    </button>
                 </div>

                 <button 
                    onClick={handlePlay}
                    className={`
                      w-14 h-14 rounded-full flex items-center justify-center 
                      transition-all shadow-lg active:scale-90
                      ${isPlaying 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
                        : 'bg-duck-accent text-duck-slate hover:bg-duck-accent/90 hover:shadow-duck-accent/50'
                      }
                    `}
                 >
                    {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8 ml-1" />}
                 </button>
              </div>
           </GlassContainer>
        </div>

      </main>
    </div>
  );
};

export default App;