import { BuddhistTerm } from './types';

export const PRESERVED_TERMS: BuddhistTerm[] = [
  { sanskrit: "Dharma", english: "teachings", preserveDiacritics: true },
  { sanskrit: "Karma", english: "action", preserveDiacritics: true },
  { sanskrit: "Buddha", english: "awakened one", preserveDiacritics: true },
  { sanskrit: "Sangha", english: "community", preserveDiacritics: true },
  { sanskrit: "Vajra", english: "diamond-like", preserveDiacritics: true }
];

export const HONORIFIC_MAPPINGS = new Map([
  ["Rinpoche", "Precious One"],
  ["Lama", "Master"],
  ["Geshe", "Learned One"],
  ["Khenpo", "Preceptor"]
]);
