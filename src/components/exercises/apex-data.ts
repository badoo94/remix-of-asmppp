export type Lang = "fr" | "en";
export type ExType = "classic" | "squat" | "belly";

export type ClassicLevel = { level: number; hold: number; rest: number; r: number; sets: number };
export type SquatDay = { d: number; a: number; r: number; b: number; s: number };
export type BellyDay = { g: number; d: number; c: number; r: number; s: number };

export const classic: ClassicLevel[] = [
  [3, 5, 5, 3], [5, 5, 8, 3], [5, 5, 10, 3], [8, 8, 10, 3], [10, 10, 10, 3], [10, 10, 12, 3],
  [10, 10, 15, 3], [10, 10, 15, 3], [10, 10, 15, 3], [10, 10, 10, 2], [10, 10, 10, 2], [10, 10, 15, 3],
].map((v, i) => ({ level: i + 1, hold: v[0], rest: v[1], r: v[2], sets: v[3] }));

// Squat tuples: descent, repetitions, breathe-after-reps, sets. Ascent is fixed at 2 seconds.
const squatRaw = [
  [[2, 8, 5, 3], [2, 10, 5, 3], [2, 8, 5, 3], [2, 10, 5, 3], [2, 8, 5, 3], [2, 10, 5, 3], [2, 12, 5, 3]],
  [[2, 8, 5, 3], [3, 8, 5, 3], [2, 10, 5, 3], [3, 10, 5, 3], [2, 8, 5, 3], [3, 8, 5, 3], [3, 10, 5, 3]],
  [[3, 8, 5, 3], [3, 10, 5, 3], [3, 8, 5, 3], [3, 10, 5, 3], [3, 8, 5, 3], [3, 10, 5, 3], [3, 8, 5, 3]],
  [[3, 8, 4, 3], [3, 10, 4, 3], [3, 8, 4, 3], [3, 10, 4, 3], [3, 8, 4, 3], [3, 8, 4, 3], [3, 8, 4, 3]],
  [[3, 8, 4, 3], [3, 10, 4, 3], [3, 8, 4, 3], [3, 10, 4, 3], [3, 10, 4, 3], [3, 8, 4, 3], [3, 8, 4, 3]],
  [[3, 10, 4, 3], [4, 10, 4, 3], [3, 12, 4, 3], [4, 12, 4, 3], [3, 10, 4, 3], [4, 10, 4, 3], [4, 12, 4, 3]],
  [[4, 8, 3, 3], [4, 10, 3, 3], [4, 8, 3, 3], [4, 8, 3, 3], [4, 6, 3, 3], [4, 8, 3, 3], [4, 8, 3, 3]],
  [[4, 8, 3, 3], [4, 10, 3, 3], [4, 8, 3, 3], [4, 8, 3, 3], [4, 10, 3, 3], [4, 8, 3, 3], [4, 8, 3, 3]],
  [[4, 6, 3, 3], [4, 8, 3, 3], [4, 8, 3, 3], [4, 8, 3, 3], [4, 6, 3, 3], [4, 5, 3, 3], [4, 6, 3, 3]],
  [[4, 8, 7, 3], [4, 8, 7, 3], [4, 6, 7, 3], [4, 6, 7, 3], [4, 6, 7, 3], [4, 8, 7, 3], [4, 6, 7, 3]],
  [[4, 8, 7, 4], [4, 8, 7, 4], [4, 6, 7, 4], [4, 6, 7, 4], [4, 6, 7, 4], [4, 5, 7, 4], [4, 5, 7, 4]],
  [[5, 5, 2, 4], [5, 5, 2, 4], [5, 5, 2, 4], [5, 4, 2, 4], [5, 4, 2, 4], [5, 3, 2, 4], [5, 4, 2, 4]],
  [[5, 5, 2, 4], [5, 4, 2, 4], [5, 5, 2, 4], [5, 4, 2, 4], [5, 5, 2, 4], [5, 4, 2, 4], [5, 4, 2, 4]],
  [[5, 4, 2, 4], [5, 3, 2, 4], [5, 4, 2, 4], [5, 4, 2, 4], [5, 3, 2, 4], [5, 3, 2, 4], [5, 2, 2, 4]],
  [[5, 3, 2, 5], [5, 3, 2, 5], [5, 2, 2, 5], [5, 3, 2, 5], [5, 2, 2, 5], [5, 2, 2, 5], [5, 2, 2, 5]],
];
export const squat = squatRaw.map((days, i) => ({
  level: i + 1,
  days: days.map((v): SquatDay => ({ d: v[0], a: 2, r: v[1], b: v[2], s: v[3] })),
}));

// Belly tuples: inflate, deflate, cycles, repetitions, sets.
const bellyRaw = [
  [[2, 2, 2, 3, 3], [2, 2, 3, 3, 3], [2, 2, 2, 3, 3], [2, 2, 3, 3, 3], [2, 2, 4, 4, 3], [2, 2, 3, 4, 3], [2, 2, 4, 4, 3]],
  [[2, 2, 4, 5, 3], [2, 2, 3, 5, 3], [2, 2, 5, 5, 3], [2, 2, 4, 5, 3], [2, 2, 5, 5, 3], [2, 2, 5, 6, 3], [2, 2, 4, 6, 3]],
  [[2, 2, 4, 7, 3], [2, 2, 5, 7, 3], [2, 2, 5, 7, 3], [2, 2, 5, 8, 3], [2, 2, 4, 8, 3], [2, 2, 5, 8, 3], [2, 2, 5, 9, 3]],
  [[2, 2, 4, 10, 3], [2, 2, 4, 10, 3], [2, 2, 5, 10, 3], [2, 2, 5, 10, 3], [2, 2, 4, 11, 3], [2, 2, 5, 11, 3], [2, 2, 5, 12, 3]],
  [[2, 2, 5, 12, 3], [2, 2, 4, 12, 3], [2, 2, 5, 12, 3], [2, 2, 5, 13, 3], [2, 2, 4, 13, 3], [2, 2, 5, 13, 3], [2, 2, 5, 14, 3]],
  [[2, 2, 5, 14, 3], [2, 2, 4, 14, 3], [2, 2, 5, 14, 3], [2, 2, 5, 15, 3], [2, 2, 4, 15, 3], [2, 2, 5, 15, 3], [2, 2, 5, 16, 3]],
  [[2, 2, 5, 16, 3], [2, 2, 4, 16, 3], [2, 2, 5, 16, 3], [2, 2, 4, 17, 3], [2, 2, 5, 17, 3], [2, 2, 4, 18, 3], [2, 2, 5, 18, 3]],
  [[2, 2, 5, 18, 3], [2, 2, 4, 18, 3], [2, 2, 5, 18, 3], [2, 2, 4, 19, 3], [2, 2, 5, 19, 3], [2, 2, 4, 20, 3], [2, 2, 5, 20, 3]],
  [[2, 2, 5, 20, 3], [2, 2, 4, 20, 3], [2, 2, 5, 20, 3], [2, 2, 4, 21, 3], [2, 2, 5, 21, 3], [2, 2, 4, 22, 3], [2, 2, 5, 22, 3]],
  [[2, 2, 5, 22, 3], [2, 2, 4, 22, 3], [2, 2, 5, 22, 3], [2, 2, 4, 23, 3], [2, 2, 5, 23, 3], [2, 2, 4, 24, 3], [2, 2, 5, 24, 3]],
  [[2, 2, 5, 24, 3], [2, 2, 5, 24, 3], [2, 2, 4, 25, 3], [2, 2, 5, 25, 3], [2, 2, 4, 26, 3], [2, 2, 5, 26, 3], [2, 2, 5, 27, 3]],
  [[2, 2, 5, 27, 3], [2, 2, 5, 27, 3], [2, 2, 4, 28, 3], [2, 2, 5, 28, 3], [2, 2, 4, 29, 3], [2, 2, 5, 29, 3], [2, 2, 5, 30, 3]],
];
export const belly = bellyRaw.map((days, i) => ({
  level: i + 1,
  days: days.map((v): BellyDay => ({ g: v[0], d: v[1], c: v[2], r: v[3], s: v[4] })),
}));

export const goals: Record<Lang, Record<ExType, string[]>> = {
  fr: {
    classic: ["Activation & Contrôle", "Endurance de Base", "Augmentation du Volume", "Renforcement de la Tenue", "L'Objectif 10 Secondes", "Maîtrise des Positions", "Contractions Avancées", "Force Maximale", "Puissance & Stamina", "Intégration Fonctionnelle", "Maîtrise & Contrôle", "Entretien à Vie"],
    squat: ["Standard 2s", "Intro Ralentissement", "Poussée Contrôlée", "Amorti Profond", "Va-et-Vient Isolé", "Augmentation du Volume", "Entrée en Endurance", "Transition Lente", "La Barre des 15 Sec", "Tension Cumulative", "Le Cap des 4 Séries", "L'Étau Hyper-Lent", "Résistance Élite", "L'Épreuve d'Acier", "Maîtrise Apex Totale"],
    belly: ["Phase d'Amorçage", "Consolidation du Rythme", "Augmentation de la Densité", "Endurance Vasculaire Basse", "Le Palier des 12 Répétitions", "Accumulation de Volume", "Résistance Pelvienne Continue", "Stabilité Érectile Majeure", "Volume Élite Progressif", "Le Cap des 24 Répétitions", "Haute Intensité Circulatoire", "Maîtrise Totale par Volume Élevé"],
  },
  en: {
    classic: ["Activation & Control", "Building Endurance", "Increasing Volume", "Strengthening Hold", "The 10-Second Goal", "Mastering Positions", "Advanced Contractions", "Peak Strength", "Power & Stamina", "Functional Integration", "Mastery & Control", "Lifetime Maintenance"],
    squat: ["Standard 2s", "Slowdown Intro", "Controlled Push", "Deep Cushioning", "Isolated Back-and-Forth", "Volume Increase", "Endurance Entry", "Slow Transition", "15-Sec Bar", "Cumulative Tension", "4-Set Cap", "Hyper-Slow Vise", "Elite Resistance", "Steel Trial", "Total Apex Mastery"],
    belly: ["Priming Phase", "Rhythm Consolidation", "Density Increase", "Low Vascular Endurance", "The 12-Rep Plateau", "Volume Accumulation", "Continuous Pelvic Resistance", "Major Erectile Stability", "Progressive Elite Volume", "The 24-Rep Cap", "High Circulatory Intensity", "Total Mastery via High Volume"],
  },
};

export const words = {
  fr: {
    choose: "Choisir l'exercice", classic: "Kegel Classique", classicDesc: "Contractions et relâchements fondamentaux.",
    squat: "Kegel Squat (Érection)", squatDesc: "Tension continue, descente et montée chronométrées.",
    belly: "Kegel Ventre (Érection)", bellyDesc: "Pompage via le bas-ventre.", levels: "Tous les niveaux",
    custom: "Personnalisé", start: "LANCER LE CUSTOM", day: "Jour", level: "Niveau", set: "Série", reps: "Rép", sec: "Sec",
    hold: "Contraction (sec)", release: "Relâchement (sec)", descent: "Descente (sec)", inflate: "Gonfler (sec)",
    deflate: "Dégonfler (sec)", cycles: "Cycles avant respiration", breath: "Respirer tous les X répétitions",
    paused: "PAUSE", play: "APPUYEZ SUR PLAY", squeeze: "CONTRACTER & TENIR", relax: "RELÂCHER & DÉTENDRE",
    down: "DESCENDRE", up: "REMONTER", breathe: "RESPIREZ", inflateText: "GONFLER LE VENTRE", deflateText: "DÉGONFLER LE VENTRE",
    rest: "REPOS", next: "Suivant", ready: "Je suis prêt, commencer", intro: "Atteignez le sommet de vos performances.",
    delete: "Supprimer toutes les données", confirm: "Supprimer toute votre progression ?", goal: "Étape",
  },
  en: {
    choose: "Choose Exercise", classic: "Classic Kegel", classicDesc: "Foundational holds and releases.",
    squat: "Squat Kegel (Erection)", squatDesc: "Continuous tension, timed descent/ascent.",
    belly: "Belly Kegel (Erection)", bellyDesc: "Pumping via lower belly.", levels: "All Levels", custom: "Custom",
    start: "START CUSTOM", day: "Day", level: "Level", set: "Set", reps: "Reps", sec: "Sec", hold: "Hold (Sec)",
    release: "Release (Sec)", descent: "Descent (Sec)", inflate: "Inflate (Sec)", deflate: "Deflate (Sec)",
    cycles: "Cycles before breathing", breath: "Breathe every X reps", paused: "PAUSED", play: "PRESS PLAY TO BEGIN",
    squeeze: "SQUEEZE & HOLD", relax: "RELEASE & RELAX", down: "DESCEND", up: "ASCEND", breathe: "BREATHE & EXHALE",
    inflateText: "INFLATE BELLY", deflateText: "DEFLATE BELLY", rest: "REST", next: "Next", ready: "I'm Ready, Start Training",
    intro: "Level up your performance.", delete: "Delete All Data", confirm: "Delete all your progress?", goal: "Goal",
  },
} as const;

export type WordKey = keyof (typeof words)["fr"];

export const onboardSteps: Record<Lang, [string, string, string?][]> = {
  fr: [
    ["Étape 1 : Trouvez les muscles", "Pour les identifier, essayez d'arrêter le jet d'urine une seule fois.", "Ce test sert uniquement à l'identification. Ne le faites pas régulièrement."],
    ["Étape 2 : Contracter et soulever", "Concentrez-vous sur le mouvement vers le haut et l'intérieur. Gardez le ventre, les fesses et les cuisses détendus."],
    ["Étape 3 : Vérification", "Une contraction correcte peut entraîner un léger mouvement vers le haut."],
  ],
  en: [
    ["Step 1: Find Your Muscles", "To identify them, try stopping urine flow once.", "For identification only. Do not do it regularly."],
    ["Step 2: 'Squeeze & Lift'", "Focus on the upward and inward lift. Keep stomach, butt and thighs relaxed."],
    ["Step 3: Visual Check", "A correct contraction may create a slight upward movement."],
  ],
};

export type Progress = Record<ExType, { days: { sets: boolean[] }[] }[]>;

export function initProgress(): Progress {
  return {
    classic: classic.map((l) => ({ days: Array.from({ length: 7 }, () => ({ sets: Array(l.sets).fill(false) })) })),
    squat: squat.map((l) => ({ days: l.days.map((d) => ({ sets: Array(d.s).fill(false) })) })),
    belly: belly.map((l) => ({ days: l.days.map((d) => ({ sets: Array(d.s).fill(false) })) })),
  };
}

export const STORAGE_KEY = "apexPowerGameState_v12";
