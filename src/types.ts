export type Lang = 'kk' | 'ru' | 'en';
export type Localized = Record<Lang, string>;
export type Category = 'mausoleum' | 'archaeology' | 'architecture' | 'nature';
export interface MuseumObject {
  id: string;
  title: Localized; region: Localized; city: Localized;
  category: Category; era: 'medieval' | 'ancient' | 'modern' | 'natural'; period: Localized;
  coordinates: [number, number]; description: Localized; significance: Localized;
  facts: Localized[];
  sources: { title: string; url: string }[];
  coordinateSources: { title: string; url: string }[];
  imageGallery: string[];
  imageCredits: { author: string; license: string; url: string; accessed: string }[];
  modelUrl: string; modelAccuracy: 'approximate'; vrAvailable: boolean;
  hotspots: { position: [number, number, number]; title: Localized; description: Localized }[];
  quizQuestions: { question: Localized; options: Localized[]; correctIndex: number; explanation: Localized }[];
}
export interface StudentProgress { [id: string]: { best: number; completed: boolean } }
