import { GoogleGenAI } from "@google/genai";
import { StoryConfig } from '../types';

const getClient = () => {
    // In a real scenario, handle missing key gracefully in UI. 
    // Here we assume environment is set up as per instructions.
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateSleepStory = async (config: StoryConfig): Promise<string> => {
  const ai = getClient();
  
  const prompt = `
    Write a soothing, sleep-inducing story in Chinese (Simplified).
    Theme: ${config.mood}.
    Specific Topic: ${config.topic || 'A peaceful journey'}.
    
    Constraints:
    1. The story should be around 500 characters.
    2. Use soft, calming, and descriptive language (ASMR style).
    3. Focus on sensory details (gentle breeze, soft light, quiet sounds).
    4. No conflict, no sudden plot twists.
    5. The ending should be extremely slow and fade into silence.
    6. Return ONLY the story text, no titles or markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text || "夜深了，星星在眨眼..."; 
  } catch (error) {
    console.error("Gemini Error:", error);
    return "网络有点小睡意，请稍后再试，或者直接听听雨声吧...";
  }
};