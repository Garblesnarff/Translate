/**
 * Temporal Resolution Service
 *
 * Handles comprehensive date resolution for Tibetan Buddhist texts including:
 * - Gregorian dates (1012, 1097, "1012 CE")
 * - Tibetan calendar (rabjung cycles)
 * - Chinese calendar (element-animal combinations)
 * - Relative dates ("after X died", "before Y was born")
 * - Era references ("during reign of King Songsten Gampo")
 * - Seasonal markers ("summer of 1050", "winter retreat")
 *
 * Phase 3, Task 3.3 of Knowledge Graph implementation
 */

import { db } from '@db/index';
import { getTables } from '@db/config';
import { eq, and, or, gte, lte } from 'drizzle-orm';
import type { DateInfo, Entity } from '../../types/entities';

// ============================================================================
// Types
// ============================================================================

export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export type Animal = 'rat' | 'ox' | 'tiger' | 'rabbit' | 'dragon' | 'snake' |
                     'horse' | 'sheep' | 'monkey' | 'bird' | 'dog' | 'pig';
export type Precision = 'exact' | 'circa' | 'estimated' | 'disputed' | 'unknown';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface TibetanDate {
  rabjung: number; // 1-17 (each is 60 years)
  year: number; // 1-60
  element: Element;
  animal: Animal;
  elementGender?: 'male' | 'female'; // Odd years = male, even years = female
}

export interface DateRange {
  start: number;
  end: number;
  precision: Precision;
  confidence: number;
}

export interface ResolvedDate extends DateInfo {
  gregorianYear: number;
  originalExpression: string;
  resolutionMethod: 'direct' | 'rabjung' | 'element-animal' | 'relative' | 'era' | 'natural-language';
  referenceEntity?: {
    id: string;
    name: string;
    type: string;
  };
}

export interface Era {
  name: string;
  alternateNames: string[];
  startYear: number;
  endYear: number;
  type: 'dynasty' | 'reign' | 'period' | 'transmission' | 'movement';
  description?: string;
  confidence: number;
}

// ============================================================================
// Rabjung Cycle Data
// ============================================================================

/**
 * Rabjung cycles (60-year cycles)
 * Rabjung 1 started in 1027 CE
 * Each rabjung is exactly 60 years
 */
export const RABJUNG_CYCLES: { [key: number]: { start: number; end: number } } = {
  1: { start: 1027, end: 1086 },
  2: { start: 1087, end: 1146 },
  3: { start: 1147, end: 1206 },
  4: { start: 1207, end: 1266 },
  5: { start: 1267, end: 1326 },
  6: { start: 1327, end: 1386 },
  7: { start: 1387, end: 1446 },
  8: { start: 1447, end: 1506 },
  9: { start: 1507, end: 1566 },
  10: { start: 1567, end: 1626 },
  11: { start: 1627, end: 1686 },
  12: { start: 1687, end: 1746 },
  13: { start: 1747, end: 1806 },
  14: { start: 1807, end: 1866 },
  15: { start: 1867, end: 1926 },
  16: { start: 1927, end: 1986 },
  17: { start: 1987, end: 2046 },
};

// ============================================================================
// Element-Animal Cycle Data
// ============================================================================

/**
 * 60-year element-animal cycle
 * Each element appears twice (male/female) before changing
 * Animals cycle every year
 */
export const ELEMENT_ANIMAL_CYCLE: Array<{ year: number; element: Element; animal: Animal; gender: 'male' | 'female' }> = [
  // Wood element (years 1-4)
  { year: 1, element: 'wood', animal: 'rat', gender: 'male' },
  { year: 2, element: 'wood', animal: 'ox', gender: 'female' },
  { year: 3, element: 'wood', animal: 'tiger', gender: 'male' },
  { year: 4, element: 'wood', animal: 'rabbit', gender: 'female' },

  // Fire element (years 5-8)
  { year: 5, element: 'fire', animal: 'dragon', gender: 'male' },
  { year: 6, element: 'fire', animal: 'snake', gender: 'female' },
  { year: 7, element: 'fire', animal: 'horse', gender: 'male' },
  { year: 8, element: 'fire', animal: 'sheep', gender: 'female' },

  // Earth element (years 9-12)
  { year: 9, element: 'earth', animal: 'monkey', gender: 'male' },
  { year: 10, element: 'earth', animal: 'bird', gender: 'female' },
  { year: 11, element: 'earth', animal: 'dog', gender: 'male' },
  { year: 12, element: 'earth', animal: 'pig', gender: 'female' },

  // Metal element (years 13-16)
  { year: 13, element: 'metal', animal: 'rat', gender: 'male' },
  { year: 14, element: 'metal', animal: 'ox', gender: 'female' },
  { year: 15, element: 'metal', animal: 'tiger', gender: 'male' },
  { year: 16, element: 'metal', animal: 'rabbit', gender: 'female' },

  // Water element (years 17-20)
  { year: 17, element: 'water', animal: 'dragon', gender: 'male' },
  { year: 18, element: 'water', animal: 'snake', gender: 'female' },
  { year: 19, element: 'water', animal: 'horse', gender: 'male' },
  { year: 20, element: 'water', animal: 'sheep', gender: 'female' },

  // Wood element (years 21-24)
  { year: 21, element: 'wood', animal: 'monkey', gender: 'male' },
  { year: 22, element: 'wood', animal: 'bird', gender: 'female' },
  { year: 23, element: 'wood', animal: 'dog', gender: 'male' },
  { year: 24, element: 'wood', animal: 'pig', gender: 'female' },

  // Fire element (years 25-28)
  { year: 25, element: 'fire', animal: 'rat', gender: 'male' },
  { year: 26, element: 'fire', animal: 'ox', gender: 'female' },
  { year: 27, element: 'fire', animal: 'tiger', gender: 'male' },
  { year: 28, element: 'fire', animal: 'rabbit', gender: 'female' },

  // Earth element (years 29-32)
  { year: 29, element: 'earth', animal: 'dragon', gender: 'male' },
  { year: 30, element: 'earth', animal: 'snake', gender: 'female' },
  { year: 31, element: 'earth', animal: 'horse', gender: 'male' },
  { year: 32, element: 'earth', animal: 'sheep', gender: 'female' },

  // Metal element (years 33-36)
  { year: 33, element: 'metal', animal: 'monkey', gender: 'male' },
  { year: 34, element: 'metal', animal: 'bird', gender: 'female' },
  { year: 35, element: 'metal', animal: 'dog', gender: 'male' },
  { year: 36, element: 'metal', animal: 'pig', gender: 'female' },

  // Water element (years 37-40)
  { year: 37, element: 'water', animal: 'rat', gender: 'male' },
  { year: 38, element: 'water', animal: 'ox', gender: 'female' },
  { year: 39, element: 'water', animal: 'tiger', gender: 'male' },
  { year: 40, element: 'water', animal: 'rabbit', gender: 'female' },

  // Wood element (years 41-44)
  { year: 41, element: 'wood', animal: 'dragon', gender: 'male' },
  { year: 42, element: 'wood', animal: 'snake', gender: 'female' },
  { year: 43, element: 'wood', animal: 'horse', gender: 'male' },
  { year: 44, element: 'wood', animal: 'sheep', gender: 'female' },

  // Fire element (years 45-48)
  { year: 45, element: 'fire', animal: 'monkey', gender: 'male' },
  { year: 46, element: 'fire', animal: 'bird', gender: 'female' },
  { year: 47, element: 'fire', animal: 'dog', gender: 'male' },
  { year: 48, element: 'fire', animal: 'pig', gender: 'female' },

  // Earth element (years 49-52)
  { year: 49, element: 'earth', animal: 'rat', gender: 'male' },
  { year: 50, element: 'earth', animal: 'ox', gender: 'female' },
  { year: 51, element: 'earth', animal: 'tiger', gender: 'male' },
  { year: 52, element: 'earth', animal: 'rabbit', gender: 'female' },

  // Metal element (years 53-56)
  { year: 53, element: 'metal', animal: 'dragon', gender: 'male' },
  { year: 54, element: 'metal', animal: 'snake', gender: 'female' },
  { year: 55, element: 'metal', animal: 'horse', gender: 'male' },
  { year: 56, element: 'metal', animal: 'sheep', gender: 'female' },

  // Water element (years 57-60)
  { year: 57, element: 'water', animal: 'monkey', gender: 'male' },
  { year: 58, element: 'water', animal: 'bird', gender: 'female' },
  { year: 59, element: 'water', animal: 'dog', gender: 'male' },
  { year: 60, element: 'water', animal: 'pig', gender: 'female' },
];

// ============================================================================
// Era Database
// ============================================================================

/**
 * Major eras in Tibetan history
 */
export const ERAS: Era[] = [
  // Tibetan Empire Period
  {
    name: 'Tibetan Empire',
    alternateNames: ['Imperial Period', 'Early Period'],
    startYear: 618,
    endYear: 842,
    type: 'period',
    description: 'Period of unified Tibetan empire',
    confidence: 0.9,
  },
  {
    name: 'Reign of Songsten Gampo',
    alternateNames: ['Songtsen Gampo', 'Srong-btsan sgam-po'],
    startYear: 617,
    endYear: 650,
    type: 'reign',
    description: 'First Dharma King of Tibet',
    confidence: 0.85,
  },
  {
    name: 'Reign of Trisong Detsen',
    alternateNames: ['Khri-srong lde-btsan', 'Tri Songdetsen'],
    startYear: 755,
    endYear: 797,
    type: 'reign',
    description: 'Second Dharma King, established Buddhism',
    confidence: 0.9,
  },

  // Fragmentation Period
  {
    name: 'Era of Fragmentation',
    alternateNames: ['Dark Age', 'Period of Fragmentation'],
    startYear: 842,
    endYear: 978,
    type: 'period',
    description: 'After collapse of Tibetan empire',
    confidence: 0.8,
  },

  // Later Diffusion Period
  {
    name: 'Later Diffusion of Buddhism',
    alternateNames: ['Phyi dar', 'Second Diffusion'],
    startYear: 978,
    endYear: 1204,
    type: 'period',
    description: 'Revival of Buddhism in Tibet',
    confidence: 0.85,
  },

  // Kadam Period
  {
    name: 'Early Kadam Period',
    alternateNames: ['Kadam Founding'],
    startYear: 1042,
    endYear: 1150,
    type: 'movement',
    description: 'Founding of Kadam tradition by Atisha',
    confidence: 0.9,
  },

  // Sakya Dominance
  {
    name: 'Sakya Period',
    alternateNames: ['Sakya Dominance', 'Sa-skya Period'],
    startYear: 1268,
    endYear: 1354,
    type: 'period',
    description: 'Period of Sakya political dominance',
    confidence: 0.9,
  },

  // Phagmodrupa Dynasty
  {
    name: 'Phagmodrupa Dynasty',
    alternateNames: ['Phag-mo-gru', 'Phagdru'],
    startYear: 1354,
    endYear: 1435,
    type: 'dynasty',
    description: 'Kagyu political period',
    confidence: 0.85,
  },

  // Rinpung Period
  {
    name: 'Rinpung Period',
    alternateNames: ['Rin-spungs'],
    startYear: 1435,
    endYear: 1565,
    type: 'dynasty',
    description: 'Rinpung family rule',
    confidence: 0.8,
  },

  // Tsangpa Dynasty
  {
    name: 'Tsangpa Dynasty',
    alternateNames: ['gTsang Dynasty'],
    startYear: 1565,
    endYear: 1642,
    type: 'dynasty',
    description: 'Kings of Tsang province',
    confidence: 0.85,
  },

  // Ganden Phodrang
  {
    name: 'Ganden Phodrang',
    alternateNames: ['dGa\'-ldan pho-brang', 'Dalai Lama Government'],
    startYear: 1642,
    endYear: 1959,
    type: 'period',
    description: 'Dalai Lama government period',
    confidence: 0.95,
  },

  // Fifth Dalai Lama Reign
  {
    name: 'Reign of Fifth Dalai Lama',
    alternateNames: ['Great Fifth'],
    startYear: 1642,
    endYear: 1682,
    type: 'reign',
    description: 'Ngawang Lobsang Gyatso period',
    confidence: 0.95,
  },

  // Rimé Movement
  {
    name: 'Rimé Movement',
    alternateNames: ['Ris-med', 'Non-sectarian Movement'],
    startYear: 1850,
    endYear: 1950,
    type: 'movement',
    description: 'Non-sectarian Buddhist revival in Eastern Tibet',
    confidence: 0.9,
  },
];

// ============================================================================
// Temporal Resolver Class
// ============================================================================

export class TemporalResolver {
  /**
   * Resolve any date expression to a Gregorian year with confidence
   */
  async resolveDate(
    dateExpression: string,
    context?: {
      documentId?: string;
      knownEntities?: Entity[];
      defaultYear?: number;
    }
  ): Promise<ResolvedDate> {
    const expr = dateExpression.trim().toLowerCase();

    // Try direct Gregorian year first
    const directYear = this.parseDirectYear(expr);
    if (directYear) {
      return {
        year: directYear,
        gregorianYear: directYear,
        precision: 'exact',
        confidence: 1.0,
        originalExpression: dateExpression,
        resolutionMethod: 'direct',
      };
    }

    // Try Tibetan calendar (rabjung)
    const rabjungDate = this.parseRabjung(expr);
    if (rabjungDate) {
      return rabjungDate;
    }

    // Try element-animal combination
    const elementAnimalDate = this.parseElementAnimal(expr, context?.defaultYear);
    if (elementAnimalDate) {
      return elementAnimalDate;
    }

    // Try relative date
    const relativeDate = await this.parseRelativeDate(expr, context);
    if (relativeDate) {
      return relativeDate;
    }

    // Try era-based date
    const eraDate = this.parseEraDate(expr);
    if (eraDate) {
      return eraDate;
    }

    // Try natural language parsing
    const naturalDate = this.parseNaturalLanguageDate(expr, context?.defaultYear);
    if (naturalDate) {
      return naturalDate;
    }

    // Could not resolve
    throw new Error(`Could not resolve date expression: "${dateExpression}"`);
  }

  /**
   * Parse direct Gregorian year (e.g., "1012", "1097 CE", "1050 AD")
   */
  private parseDirectYear(expr: string): number | null {
    // Remove common suffixes
    const cleaned = expr
      .replace(/\s*(ce|ad|bce|bc)\s*$/i, '')
      .replace(/[,\s]/g, '')
      .trim();

    const yearMatch = cleaned.match(/^(\d{3,4})$/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      if (year >= 600 && year <= 2100) {
        return year;
      }
    }

    return null;
  }

  /**
   * Parse Tibetan rabjung date
   * Example: "fire-dragon year of the 14th rabjung"
   */
  private parseRabjung(expr: string): ResolvedDate | null {
    // Extract rabjung number
    const rabjungMatch = expr.match(/(\d{1,2})(th|st|nd|rd)?\s+rabjung/i);
    if (!rabjungMatch) {
      return null;
    }

    const rabjungNum = parseInt(rabjungMatch[1], 10);
    const rabjungCycle = RABJUNG_CYCLES[rabjungNum];

    if (!rabjungCycle) {
      throw new Error(`Invalid rabjung number: ${rabjungNum}`);
    }

    // Try to find element and animal
    const element = this.extractElement(expr);
    const animal = this.extractAnimal(expr);

    if (element && animal) {
      // Find exact year within rabjung
      const year = this.findYearInRabjung(rabjungNum, element, animal);
      if (year) {
        return {
          year,
          gregorianYear: year,
          tibetanYear: {
            rabjung: rabjungNum,
            year: year - rabjungCycle.start + 1,
            element,
            animal,
          },
          precision: 'exact',
          confidence: 0.9,
          originalExpression: expr,
          resolutionMethod: 'rabjung',
        };
      }
    }

    // Just rabjung, no element/animal - return middle of rabjung
    const midYear = Math.floor((rabjungCycle.start + rabjungCycle.end) / 2);
    return {
      year: midYear,
      gregorianYear: midYear,
      tibetanYear: {
        rabjung: rabjungNum,
        year: 30,
        element: 'earth',
        animal: 'horse',
      },
      precision: 'estimated',
      confidence: 0.5,
      originalExpression: expr,
      resolutionMethod: 'rabjung',
    };
  }

  /**
   * Parse element-animal combination
   * Example: "fire-dragon year"
   */
  private parseElementAnimal(expr: string, contextYear?: number): ResolvedDate | null {
    const element = this.extractElement(expr);
    const animal = this.extractAnimal(expr);

    if (!element || !animal) {
      return null;
    }

    // Find the year within the 60-year cycle
    const cycleEntry = ELEMENT_ANIMAL_CYCLE.find(
      e => e.element === element && e.animal === animal
    );

    if (!cycleEntry) {
      return null;
    }

    // Calculate most likely Gregorian year
    // If we have a context year, find the nearest occurrence
    let gregorianYear: number;
    let confidence = 0.7;

    if (contextYear) {
      // Find closest cycle year to context
      const baseCycleYear = 1027 + cycleEntry.year - 1;
      const cyclesPassed = Math.round((contextYear - baseCycleYear) / 60);
      gregorianYear = baseCycleYear + (cyclesPassed * 60);
      confidence = 0.8;
    } else {
      // Default to most recent occurrence before 1500
      gregorianYear = 1027 + cycleEntry.year - 1;
      while (gregorianYear + 60 < 1500) {
        gregorianYear += 60;
      }
      confidence = 0.6;
    }

    return {
      year: gregorianYear,
      gregorianYear,
      tibetanYear: {
        rabjung: this.yearToRabjung(gregorianYear).rabjung,
        year: cycleEntry.year,
        element,
        animal,
      },
      precision: 'circa',
      confidence,
      originalExpression: expr,
      resolutionMethod: 'element-animal',
    };
  }

  /**
   * Parse relative date expressions
   * Examples: "after Marpa died", "before Atisha was born", "at age 40"
   */
  private async parseRelativeDate(
    expr: string,
    context?: {
      documentId?: string;
      knownEntities?: Entity[];
      defaultYear?: number;
    }
  ): Promise<ResolvedDate | null> {
    // Pattern: "after X died"
    const afterDeathMatch = expr.match(/after\s+(.+?)\s+(died|passed away|passed)/i);
    if (afterDeathMatch) {
      const entityName = afterDeathMatch[1];
      const entity = await this.findEntity(entityName, context?.knownEntities);

      if (entity && (entity.dates as any)?.death?.year) {
        const deathYear = (entity.dates as any).death.year;
        return {
          year: deathYear + 1,
          gregorianYear: deathYear + 1,
          precision: 'circa',
          confidence: 0.7,
          originalExpression: expr,
          resolutionMethod: 'relative',
          relative: `after ${entity.canonicalName} died`,
          referenceEntity: {
            id: entity.id,
            name: entity.canonicalName,
            type: entity.type,
          },
        };
      }
    }

    // Pattern: "before X was born"
    const beforeBirthMatch = expr.match(/before\s+(.+?)\s+(was born|birth)/i);
    if (beforeBirthMatch) {
      const entityName = beforeBirthMatch[1];
      const entity = await this.findEntity(entityName, context?.knownEntities);

      if (entity && (entity.dates as any)?.birth?.year) {
        const birthYear = (entity.dates as any).birth.year;
        return {
          year: birthYear - 1,
          gregorianYear: birthYear - 1,
          precision: 'circa',
          confidence: 0.7,
          originalExpression: expr,
          resolutionMethod: 'relative',
          relative: `before ${entity.canonicalName} was born`,
          referenceEntity: {
            id: entity.id,
            name: entity.canonicalName,
            type: entity.type,
          },
        };
      }
    }

    // Pattern: "X years after Y died/was born"
    const yearsAfterMatch = expr.match(/(\d+)\s+years?\s+after\s+(.+?)\s+(died|was born|birth)/i);
    if (yearsAfterMatch) {
      const offset = parseInt(yearsAfterMatch[1], 10);
      const entityName = yearsAfterMatch[2];
      const eventType = yearsAfterMatch[3];
      const entity = await this.findEntity(entityName, context?.knownEntities);

      if (entity) {
        const referenceYear = eventType.includes('born') || eventType.includes('birth')
          ? (entity.dates as any)?.birth?.year
          : (entity.dates as any)?.death?.year;

        if (referenceYear) {
          return {
            year: referenceYear + offset,
            gregorianYear: referenceYear + offset,
            precision: 'circa',
            confidence: 0.75,
            originalExpression: expr,
            resolutionMethod: 'relative',
            relative: `${offset} years after ${entity.canonicalName} ${eventType}`,
            referenceEntity: {
              id: entity.id,
              name: entity.canonicalName,
              type: entity.type,
            },
          };
        }
      }
    }

    // Pattern: "at age 40" (needs context entity)
    const atAgeMatch = expr.match(/at age (\d+)/i);
    if (atAgeMatch && context?.knownEntities && context.knownEntities.length > 0) {
      const age = parseInt(atAgeMatch[1], 10);
      // Use most recent person entity as context
      const personEntity = context.knownEntities.find(e => e.type === 'person');

      if (personEntity && personEntity.dates?.birth?.year) {
        const birthYear = personEntity.dates.birth.year;
        return {
          year: birthYear + age,
          gregorianYear: birthYear + age,
          precision: 'exact',
          confidence: 0.85,
          originalExpression: expr,
          resolutionMethod: 'relative',
          relative: `at age ${age}`,
          referenceEntity: {
            id: personEntity.id,
            name: personEntity.canonicalName,
            type: personEntity.type,
          },
        };
      }
    }

    return null;
  }

  /**
   * Parse era-based dates
   * Examples: "during reign of King Songsten Gampo", "in the Sakya period"
   */
  private parseEraDate(expr: string): ResolvedDate | null {
    // Find matching era
    const matchingEra = ERAS.find(era => {
      const allNames = [era.name, ...era.alternateNames].map(n => n.toLowerCase());
      return allNames.some(name => expr.includes(name.toLowerCase()));
    });

    if (!matchingEra) {
      return null;
    }

    // Determine if early, middle, or late in era
    let year: number;
    let precision: Precision = 'estimated';
    let confidence = matchingEra.confidence;

    if (expr.includes('early') || expr.includes('beginning')) {
      year = matchingEra.startYear + Math.floor((matchingEra.endYear - matchingEra.startYear) * 0.2);
      confidence *= 0.8;
    } else if (expr.includes('late') || expr.includes('end')) {
      year = matchingEra.endYear - Math.floor((matchingEra.endYear - matchingEra.startYear) * 0.2);
      confidence *= 0.8;
    } else {
      // Default to middle
      year = Math.floor((matchingEra.startYear + matchingEra.endYear) / 2);
      confidence *= 0.7;
    }

    return {
      year,
      gregorianYear: year,
      precision,
      confidence,
      era: matchingEra.name,
      originalExpression: expr,
      resolutionMethod: 'era',
    };
  }

  /**
   * Parse natural language date expressions
   * Examples: "summer of 1050", "winter retreat 1045"
   */
  parseNaturalLanguageDate(expr: string, contextYear?: number): ResolvedDate | null {
    // Pattern: "season of year"
    const seasonYearMatch = expr.match(/(spring|summer|fall|autumn|winter)\s+of\s+(\d{3,4})/i);
    if (seasonYearMatch) {
      const seasonRaw = seasonYearMatch[1].toLowerCase();
      const season = (seasonRaw === 'autumn' ? 'fall' : seasonRaw) as Season;
      const year = parseInt(seasonYearMatch[2], 10);

      return {
        year,
        gregorianYear: year,
        season: season,
        precision: 'exact',
        confidence: 0.95,
        originalExpression: expr,
        resolutionMethod: 'natural-language',
      };
    }

    // Pattern: "mid-century", "early 11th century"
    const centuryMatch = expr.match(/(early|mid|late)?\s*(\d{1,2})(th|st|nd|rd)?\s+century/i);
    if (centuryMatch) {
      const position = centuryMatch[1]?.toLowerCase();
      const century = parseInt(centuryMatch[2], 10);

      let year: number;
      const centuryStart = (century - 1) * 100;

      if (position === 'early') {
        year = centuryStart + 20;
      } else if (position === 'late') {
        year = centuryStart + 80;
      } else {
        year = centuryStart + 50;
      }

      return {
        year,
        gregorianYear: year,
        precision: 'estimated',
        confidence: 0.6,
        originalExpression: expr,
        resolutionMethod: 'natural-language',
      };
    }

    return null;
  }

  /**
   * Convert Tibetan calendar to Gregorian
   */
  convertTibetanToGregorian(
    rabjung: number,
    year: number,
    element?: Element,
    animal?: Animal
  ): number {
    const rabjungCycle = RABJUNG_CYCLES[rabjung];
    if (!rabjungCycle) {
      throw new Error(`Invalid rabjung: ${rabjung}`);
    }

    if (year < 1 || year > 60) {
      throw new Error(`Invalid year within rabjung: ${year} (must be 1-60)`);
    }

    const gregorianYear = rabjungCycle.start + year - 1;

    // Validate element and animal if provided
    if (element && animal) {
      const cycleEntry = ELEMENT_ANIMAL_CYCLE[year - 1];
      if (cycleEntry.element !== element || cycleEntry.animal !== animal) {
        console.warn(
          `Element/animal mismatch for rabjung ${rabjung} year ${year}: ` +
          `expected ${cycleEntry.element}-${cycleEntry.animal}, got ${element}-${animal}`
        );
      }
    }

    return gregorianYear;
  }

  /**
   * Resolve relative date based on reference entity
   */
  async resolveRelativeDate(
    expression: string,
    referenceEntity: Entity
  ): Promise<DateInfo> {
    // Extract offset and reference point
    const afterMatch = expression.match(/after\s+(.+?)\s+(died|was born|birth)/i);
    const beforeMatch = expression.match(/before\s+(.+?)\s+(died|was born|birth)/i);
    const yearsMatch = expression.match(/(\d+)\s+years?\s+(after|before)/i);

    let offset = 0;
    let referenceDate: DateInfo | undefined;

    if (yearsMatch) {
      offset = parseInt(yearsMatch[1], 10);
      if (yearsMatch[2] === 'before') {
        offset = -offset;
      }
    } else if (afterMatch) {
      offset = 1;
    } else if (beforeMatch) {
      offset = -1;
    }

    // Find reference date
    if (afterMatch || beforeMatch) {
      const eventType = (afterMatch || beforeMatch)![2];
      if (eventType.includes('born') || eventType.includes('birth')) {
        referenceDate = (referenceEntity.dates as any)?.birth;
      } else {
        referenceDate = (referenceEntity.dates as any)?.death;
      }
    }

    if (!referenceDate?.year) {
      throw new Error(`Reference entity ${referenceEntity.canonicalName} has no ${referenceDate} date`);
    }

    return {
      year: referenceDate.year + offset,
      precision: 'circa',
      confidence: referenceDate.confidence * 0.85,
      relative: expression,
      source: `Calculated from ${referenceEntity.canonicalName}`,
    };
  }

  /**
   * Resolve era-based date to date range
   */
  resolveEraDate(eraName: string): DateRange {
    const era = ERAS.find(e =>
      e.name.toLowerCase() === eraName.toLowerCase() ||
      e.alternateNames.some(n => n.toLowerCase() === eraName.toLowerCase())
    );

    if (!era) {
      throw new Error(`Unknown era: ${eraName}`);
    }

    return {
      start: era.startYear,
      end: era.endYear,
      precision: 'estimated',
      confidence: era.confidence,
    };
  }

  /**
   * Calculate age based on birth year and event year
   */
  calculateAge(birthYear: number, eventYear: number): number {
    return eventYear - birthYear;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Extract element from text
   */
  private extractElement(text: string): Element | null {
    const elements: Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];
    for (const element of elements) {
      if (text.includes(element)) {
        return element;
      }
    }
    return null;
  }

  /**
   * Extract animal from text
   */
  private extractAnimal(text: string): Animal | null {
    const animals: Animal[] = [
      'rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake',
      'horse', 'sheep', 'monkey', 'bird', 'dog', 'pig'
    ];

    for (const animal of animals) {
      if (text.includes(animal)) {
        return animal;
      }
    }

    // Check for alternate names
    if (text.includes('rooster') || text.includes('chicken')) return 'bird';
    if (text.includes('goat')) return 'sheep';
    if (text.includes('buffalo') || text.includes('cow')) return 'ox';
    if (text.includes('hare')) return 'rabbit';

    return null;
  }

  /**
   * Find year within rabjung given element and animal
   */
  private findYearInRabjung(rabjung: number, element: Element, animal: Animal): number | null {
    const rabjungCycle = RABJUNG_CYCLES[rabjung];
    if (!rabjungCycle) {
      return null;
    }

    const cycleEntry = ELEMENT_ANIMAL_CYCLE.find(
      e => e.element === element && e.animal === animal
    );

    if (!cycleEntry) {
      return null;
    }

    return rabjungCycle.start + cycleEntry.year - 1;
  }

  /**
   * Convert Gregorian year to rabjung
   */
  private yearToRabjung(year: number): { rabjung: number; year: number } {
    for (const [rabjungNum, cycle] of Object.entries(RABJUNG_CYCLES)) {
      if (year >= cycle.start && year <= cycle.end) {
        return {
          rabjung: parseInt(rabjungNum, 10),
          year: year - cycle.start + 1,
        };
      }
    }

    throw new Error(`Year ${year} is outside known rabjung cycles (1027-2046)`);
  }

  /**
   * Find entity by name (search database or context)
   */
  private async findEntity(
    name: string,
    knownEntities?: Entity[]
  ): Promise<Entity | null> {
    // First check known entities from context
    if (knownEntities) {
      const found = knownEntities.find(e =>
        e.canonicalName.toLowerCase().includes(name.toLowerCase()) ||
        e.names.english.some(n => n.toLowerCase().includes(name.toLowerCase())) ||
        e.names.phonetic.some(n => n.toLowerCase().includes(name.toLowerCase()))
      );

      if (found) {
        return found;
      }
    }

    // Search database
    try {
      const tables = getTables();
      const results = await db
        .select()
        .from(tables.entities)
        .where(
          or(
            eq(tables.entities.canonicalName, name),
            // Note: For JSON field search, we'd need to use SQL LIKE on the JSON field
            // This is a simplified version
          )
        )
        .limit(1);

      if (results.length > 0) {
        const entity = results[0];
        return {
          id: entity.id,
          type: entity.type as any,
          canonicalName: entity.canonicalName,
          names: JSON.parse(entity.names as string),
          attributes: JSON.parse(entity.attributes as string),
          dates: entity.dates ? JSON.parse(entity.dates as string) : undefined,
          confidence: parseFloat(entity.confidence as string),
          verified: entity.verified === 1,
          createdAt: entity.createdAt as Date,
          updatedAt: entity.updatedAt as Date,
          createdBy: entity.createdBy as string,
        } as Entity;
      }
    } catch (error) {
      console.error('[TemporalResolver] Error searching for entity:', error);
    }

    return null;
  }
}

// Export singleton instance
export const temporalResolver = new TemporalResolver();
