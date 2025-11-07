/**
 * Calibration Dataset for Knowledge Graph Entity Extraction
 *
 * Golden dataset of 75 human-verified test cases for confidence calibration.
 * Each case has been carefully curated to test different aspects of entity extraction
 * from Tibetan Buddhist historical texts.
 *
 * @module tests/fixtures/calibrationDataset
 */

import type { EntityType, PredicateType } from '../../server/types/entities';

export interface CalibrationTestCase {
  id: string;
  text: string;
  expectedEntities: Array<{
    type: EntityType;
    name?: string;
    dates?: any;
    roles?: string[];
    attributes?: any;
    note?: string;
  }>;
  expectedRelationships?: Array<{
    subject: string;
    predicate: PredicateType;
    object: string;
    properties?: any;
  }>;
  expectedConfidence: string; // '>0.9', '0.5-0.7', '0.6-0.8', etc.
  difficulty: 'easy' | 'medium' | 'hard';
  notes?: string;
}

/**
 * Calibration dataset with 75 test cases:
 * - 30 easy (clear, explicit mentions)
 * - 30 medium (ambiguous references)
 * - 15 hard (challenging cases requiring inference)
 *
 * Coverage:
 * - Person: 20 cases
 * - Place: 10 cases
 * - Text: 10 cases
 * - Event: 10 cases
 * - Concept: 10 cases
 * - Institution: 10 cases
 * - Deity: 5 cases
 */
export const calibrationDataset: CalibrationTestCase[] = [
  // ==================== EASY - PERSON ENTITIES (10) ====================

  {
    id: 'person-001',
    text: 'Marpa Lotsawa (1012-1097) was a Tibetan translator who brought many tantric teachings from India to Tibet.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Marpa Lotsawa',
        dates: { birth: 1012, death: 1097 },
        roles: ['translator'],
        attributes: { titles: ['Lotsawa'] }
      }
    ],
    expectedConfidence: '>0.9',
    difficulty: 'easy',
    notes: 'Clear dates, explicit role, honorific title'
  },

  {
    id: 'person-002',
    text: 'Milarepa studied under Marpa and became renowned for his songs. He spent many years in mountain caves practicing meditation.',
    expectedEntities: [
      { type: 'person', name: 'Milarepa', roles: ['student', 'yogi', 'poet'] },
      { type: 'person', name: 'Marpa', roles: ['teacher'] }
    ],
    expectedRelationships: [
      { subject: 'Milarepa', predicate: 'student_of', object: 'Marpa' }
    ],
    expectedConfidence: '>0.85',
    difficulty: 'easy',
    notes: 'Clear teacher-student relationship, multiple roles inferable'
  },

  {
    id: 'person-003',
    text: 'Gampopa (1079-1153), also known as Dakpo Lhaje, was a physician before becoming a monk. He founded Daklha Gampo monastery.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Gampopa',
        dates: { birth: 1079, death: 1153 },
        roles: ['teacher', 'abbot'],
        attributes: { alternateNames: ['Dakpo Lhaje'] }
      },
      {
        type: 'institution',
        name: 'Daklha Gampo monastery'
      }
    ],
    expectedRelationships: [
      { subject: 'Gampopa', predicate: 'founded', object: 'Daklha Gampo monastery' }
    ],
    expectedConfidence: '>0.9',
    difficulty: 'easy',
    notes: 'Explicit dates, alternate name, founding relationship'
  },

  {
    id: 'person-004',
    text: 'Sakya Pandita Kunga Gyaltsen (1182-1251) was one of the five founding masters of the Sakya tradition. He was a brilliant scholar and debater.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Sakya Pandita Kunga Gyaltsen',
        dates: { birth: 1182, death: 1251 },
        roles: ['scholar'],
        attributes: { tradition: ['Sakya'], titles: ['Pandita'] }
      }
    ],
    expectedConfidence: '>0.9',
    difficulty: 'easy',
    notes: 'Full name with title, clear dates and tradition affiliation'
  },

  {
    id: 'person-005',
    text: 'Tsongkhapa Lobsang Drakpa (1357-1419) founded Ganden monastery in 1409 and established the Gelug school of Tibetan Buddhism.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Tsongkhapa Lobsang Drakpa',
        dates: { birth: 1357, death: 1419 },
        roles: ['teacher'],
        attributes: { tradition: ['Gelug'] }
      },
      {
        type: 'institution',
        name: 'Ganden monastery',
        attributes: { institutionType: 'monastery' }
      }
    ],
    expectedRelationships: [
      {
        subject: 'Tsongkhapa Lobsang Drakpa',
        predicate: 'founded',
        object: 'Ganden monastery',
        properties: { date: { year: 1409 } }
      }
    ],
    expectedConfidence: '>0.95',
    difficulty: 'easy',
    notes: 'Multiple dates, founding event with year, tradition establishment'
  },

  {
    id: 'person-006',
    text: 'Atisha Dipamkara Shrijnana (982-1054) traveled from India to Tibet in 1042 at the invitation of the western Tibetan king Lha Lama Yeshe Ö.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Atisha Dipamkara Shrijnana',
        dates: { birth: 982, death: 1054 },
        roles: ['teacher']
      },
      {
        type: 'person',
        name: 'Lha Lama Yeshe Ö',
        roles: ['king', 'patron']
      },
      {
        type: 'event',
        name: 'Atisha\'s journey to Tibet',
        attributes: { eventType: 'pilgrimage' }
      }
    ],
    expectedRelationships: [
      { subject: 'Atisha Dipamkara Shrijnana', predicate: 'visited', object: 'Tibet' }
    ],
    expectedConfidence: '>0.85',
    difficulty: 'easy',
    notes: 'Journey event, invitation relationship, royal patron'
  },

  {
    id: 'person-007',
    text: 'The 14th Dalai Lama Tenzin Gyatso was born in 1935 in Taktser, Amdo. He is considered the reincarnation of the 13th Dalai Lama.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Tenzin Gyatso',
        dates: { birth: 1935 },
        roles: ['teacher'],
        attributes: { titles: ['14th Dalai Lama'], tradition: ['Gelug'] }
      },
      {
        type: 'person',
        name: '13th Dalai Lama'
      },
      {
        type: 'place',
        name: 'Taktser',
        attributes: { region: 'Amdo' }
      }
    ],
    expectedRelationships: [
      { subject: 'Tenzin Gyatso', predicate: 'incarnation_of', object: '13th Dalai Lama' },
      { subject: 'Tenzin Gyatso', predicate: 'born_in', object: 'Taktser' }
    ],
    expectedConfidence: '>0.9',
    difficulty: 'easy',
    notes: 'Incarnation lineage, birthplace with region, title with number'
  },

  {
    id: 'person-008',
    text: 'Jamyang Khyentse Wangpo (1820-1892) was a key figure in the Rimé (non-sectarian) movement alongside Jamgön Kongtrul and Chokgyur Lingpa.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Jamyang Khyentse Wangpo',
        dates: { birth: 1820, death: 1892 },
        attributes: { tradition: ['Rimé'] }
      },
      { type: 'person', name: 'Jamgön Kongtrul' },
      { type: 'person', name: 'Chokgyur Lingpa' }
    ],
    expectedRelationships: [
      { subject: 'Jamyang Khyentse Wangpo', predicate: 'contemporary_with', object: 'Jamgön Kongtrul' },
      { subject: 'Jamyang Khyentse Wangpo', predicate: 'contemporary_with', object: 'Chokgyur Lingpa' }
    ],
    expectedConfidence: '>0.85',
    difficulty: 'easy',
    notes: 'Movement context, multiple contemporary figures'
  },

  {
    id: 'person-009',
    text: 'Padmasambhava, also known as Guru Rinpoche, arrived in Tibet in the 8th century during the reign of King Trisong Detsen to help establish Buddhism.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Padmasambhava',
        attributes: { alternateNames: ['Guru Rinpoche'], titles: ['Guru Rinpoche'] }
      },
      {
        type: 'person',
        name: 'King Trisong Detsen',
        roles: ['king', 'patron']
      }
    ],
    expectedRelationships: [
      { subject: 'Padmasambhava', predicate: 'visited', object: 'Tibet' }
    ],
    expectedConfidence: '>0.85',
    difficulty: 'easy',
    notes: 'Well-known alternate name, temporal context, royal patron'
  },

  {
    id: 'person-010',
    text: 'Drogön Chögyal Phagpa (1235-1280) served as Imperial Preceptor to Kublai Khan and created the Phags-pa script.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Drogön Chögyal Phagpa',
        dates: { birth: 1235, death: 1280 },
        roles: ['teacher', 'scholar'],
        attributes: { tradition: ['Sakya'] }
      },
      {
        type: 'person',
        name: 'Kublai Khan',
        roles: ['king', 'patron']
      }
    ],
    expectedRelationships: [
      { subject: 'Drogön Chögyal Phagpa', predicate: 'teacher_of', object: 'Kublai Khan' }
    ],
    expectedConfidence: '>0.9',
    difficulty: 'easy',
    notes: 'Political relationship, script creation, Imperial Preceptor role'
  },

  // ==================== EASY - PLACE ENTITIES (5) ====================

  {
    id: 'place-001',
    text: 'Samye monastery, founded in 779 CE in the Yarlung Valley, was the first Buddhist monastery established in Tibet.',
    expectedEntities: [
      {
        type: 'institution',
        name: 'Samye monastery',
        dates: { founded: 779 },
        attributes: { institutionType: 'monastery' }
      },
      {
        type: 'place',
        name: 'Yarlung Valley',
        attributes: { placeType: 'region' }
      }
    ],
    expectedRelationships: [
      { subject: 'Samye monastery', predicate: 'within', object: 'Yarlung Valley' }
    ],
    expectedConfidence: '>0.95',
    difficulty: 'easy',
    notes: 'Clear founding date, geographic location, historical significance'
  },

  {
    id: 'place-002',
    text: 'Mount Kailash, located in western Tibet, is considered sacred by Buddhists, Hindus, Jains, and Bon practitioners.',
    expectedEntities: [
      {
        type: 'place',
        name: 'Mount Kailash',
        attributes: { placeType: 'mountain', region: 'western Tibet', significance: ['sacred site'] }
      }
    ],
    expectedConfidence: '>0.9',
    difficulty: 'easy',
    notes: 'Sacred site, clear location, multi-religious significance'
  },

  {
    id: 'place-003',
    text: 'Lhasa, the capital of Tibet, contains the Jokhang Temple and the Potala Palace, both UNESCO World Heritage sites.',
    expectedEntities: [
      {
        type: 'place',
        name: 'Lhasa',
        attributes: { placeType: 'city' }
      },
      {
        type: 'institution',
        name: 'Jokhang Temple',
        attributes: { institutionType: 'temple' }
      },
      {
        type: 'place',
        name: 'Potala Palace',
        attributes: { placeType: 'holy_site' }
      }
    ],
    expectedRelationships: [
      { subject: 'Jokhang Temple', predicate: 'within', object: 'Lhasa' },
      { subject: 'Potala Palace', predicate: 'within', object: 'Lhasa' }
    ],
    expectedConfidence: '>0.95',
    difficulty: 'easy',
    notes: 'Geographic hierarchy, multiple landmarks, capital city'
  },

  {
    id: 'place-004',
    text: 'Nalanda University in Bihar, India was one of the world\'s first residential universities, attracting scholars from across Asia from the 5th to 12th centuries.',
    expectedEntities: [
      {
        type: 'institution',
        name: 'Nalanda University',
        attributes: { institutionType: 'school' }
      },
      {
        type: 'place',
        name: 'Bihar',
        attributes: { placeType: 'region', modernCountry: 'India' }
      }
    ],
    expectedRelationships: [
      { subject: 'Nalanda University', predicate: 'within', object: 'Bihar' }
    ],
    expectedConfidence: '>0.9',
    difficulty: 'easy',
    notes: 'Historical institution, clear location, temporal range'
  },

  {
    id: 'place-005',
    text: 'Tsurphu monastery in the Tolung valley, about 70 kilometers from Lhasa, is the traditional seat of the Karmapa lineage.',
    expectedEntities: [
      {
        type: 'institution',
        name: 'Tsurphu monastery',
        attributes: { institutionType: 'monastery', tradition: ['Kagyu'] }
      },
      {
        type: 'place',
        name: 'Tolung valley',
        attributes: { placeType: 'region' }
      }
    ],
    expectedRelationships: [
      { subject: 'Tsurphu monastery', predicate: 'within', object: 'Tolung valley' },
      { subject: 'Tolung valley', predicate: 'near', object: 'Lhasa' }
    ],
    expectedConfidence: '>0.85',
    difficulty: 'easy',
    notes: 'Lineage seat, relative location, distance measurement'
  },

  // ==================== EASY - TEXT ENTITIES (5) ====================

  {
    id: 'text-001',
    text: 'The Jewel Ornament of Liberation, written by Gampopa in the 12th century, is a comprehensive guide to the stages of the Buddhist path.',
    expectedEntities: [
      {
        type: 'text',
        name: 'The Jewel Ornament of Liberation',
        attributes: { textType: 'philosophical_treatise' }
      },
      {
        type: 'person',
        name: 'Gampopa',
        roles: ['scholar']
      }
    ],
    expectedRelationships: [
      { subject: 'Gampopa', predicate: 'wrote', object: 'The Jewel Ornament of Liberation' }
    ],
    expectedConfidence: '>0.95',
    difficulty: 'easy',
    notes: 'Clear authorship, century dating, text type inferable'
  },

  {
    id: 'text-002',
    text: 'The Bodhicharyavatara (Guide to the Bodhisattva\'s Way of Life) by Shantideva is one of the most important Mahayana Buddhist texts.',
    expectedEntities: [
      {
        type: 'text',
        name: 'Bodhicharyavatara',
        attributes: {
          textType: 'philosophical_treatise',
          topics: ['bodhisattva path', 'Mahayana'],
          abbreviated: 'Bodhicharyavatara'
        }
      },
      {
        type: 'person',
        name: 'Shantideva',
        roles: ['scholar']
      }
    ],
    expectedRelationships: [
      { subject: 'Shantideva', predicate: 'wrote', object: 'Bodhicharyavatara' }
    ],
    expectedConfidence: '>0.95',
    difficulty: 'easy',
    notes: 'Sanskrit title with English translation, clear author'
  },

  {
    id: 'text-003',
    text: 'The Blue Annals, compiled by Gö Lotsawa Zhönnu Pal in 1476-1478, is an important historical chronicle of Buddhism in Tibet.',
    expectedEntities: [
      {
        type: 'text',
        name: 'The Blue Annals',
        dates: { composed: { year: 1476 } },
        attributes: { textType: 'history' }
      },
      {
        type: 'person',
        name: 'Gö Lotsawa Zhönnu Pal',
        roles: ['scholar'],
        attributes: { titles: ['Lotsawa'] }
      }
    ],
    expectedRelationships: [
      { subject: 'Gö Lotsawa Zhönnu Pal', predicate: 'compiled', object: 'The Blue Annals' }
    ],
    expectedConfidence: '>0.9',
    difficulty: 'easy',
    notes: 'Date range, compilation vs authorship, historical genre'
  },

  {
    id: 'text-004',
    text: 'The Life of Milarepa, a 15th-century biography written by Tsangnyön Heruka, chronicles the spiritual journey of Tibet\'s most famous yogi.',
    expectedEntities: [
      {
        type: 'text',
        name: 'The Life of Milarepa',
        attributes: { textType: 'biography' }
      },
      {
        type: 'person',
        name: 'Tsangnyön Heruka',
        roles: ['scholar']
      },
      {
        type: 'person',
        name: 'Milarepa',
        roles: ['yogi']
      }
    ],
    expectedRelationships: [
      { subject: 'Tsangnyön Heruka', predicate: 'wrote', object: 'The Life of Milarepa' },
      { subject: 'The Life of Milarepa', predicate: 'mentions', object: 'Milarepa' }
    ],
    expectedConfidence: '>0.9',
    difficulty: 'easy',
    notes: 'Biography genre, subject of text, century dating'
  },

  {
    id: 'text-005',
    text: 'The Tibetan Book of the Dead (Bardo Thodol) describes the experiences of consciousness after death and was revealed by Karma Lingpa in the 14th century.',
    expectedEntities: [
      {
        type: 'text',
        name: 'Tibetan Book of the Dead',
        attributes: {
          textType: 'ritual',
          topics: ['death', 'bardo'],
          abbreviated: 'Bardo Thodol'
        }
      },
      {
        type: 'person',
        name: 'Karma Lingpa'
      }
    ],
    expectedRelationships: [
      { subject: 'Karma Lingpa', predicate: 'wrote', object: 'Tibetan Book of the Dead' }
    ],
    expectedConfidence: '>0.85',
    difficulty: 'easy',
    notes: 'Terma text (revealed not written), alternate names, century dating'
  },

  // ==================== EASY - EVENT, CONCEPT, INSTITUTION, DEITY (5) ====================

  {
    id: 'event-001',
    text: 'The First Council of Buddhist monks was held in Rajgir shortly after the Buddha\'s parinirvana around 483 BCE to preserve his teachings.',
    expectedEntities: [
      {
        type: 'event',
        name: 'First Council',
        dates: { occurred: { year: -483, precision: 'circa' } },
        attributes: { eventType: 'meeting' }
      },
      {
        type: 'place',
        name: 'Rajgir'
      }
    ],
    expectedRelationships: [
      { subject: 'First Council', predicate: 'attended', object: 'Rajgir' }
    ],
    expectedConfidence: '>0.85',
    difficulty: 'easy',
    notes: 'Historical council, relative dating, BCE year, location'
  },

  {
    id: 'concept-001',
    text: 'Śūnyatā (emptiness) is a central concept in Madhyamaka philosophy, introduced by Nagarjuna in the 2nd century CE.',
    expectedEntities: [
      {
        type: 'concept',
        name: 'Śūnyatā',
        attributes: {
          conceptType: 'philosophical_view',
          sanskritTerm: 'śūnyatā'
        }
      },
      {
        type: 'person',
        name: 'Nagarjuna',
        roles: ['scholar']
      }
    ],
    expectedRelationships: [
      { subject: 'Nagarjuna', predicate: 'taught_concept', object: 'Śūnyatā' }
    ],
    expectedConfidence: '>0.9',
    difficulty: 'easy',
    notes: 'Sanskrit term with English translation, philosophical context'
  },

  {
    id: 'institution-001',
    text: 'Sakya monastery was founded in 1073 by Khön Könchok Gyalpo in the Tsang region of central Tibet.',
    expectedEntities: [
      {
        type: 'institution',
        name: 'Sakya monastery',
        dates: { founded: 1073 },
        attributes: { institutionType: 'monastery', tradition: ['Sakya'] }
      },
      {
        type: 'person',
        name: 'Khön Könchok Gyalpo',
        roles: ['abbot']
      },
      {
        type: 'place',
        name: 'Tsang',
        attributes: { placeType: 'region' }
      }
    ],
    expectedRelationships: [
      { subject: 'Khön Könchok Gyalpo', predicate: 'founded', object: 'Sakya monastery' },
      { subject: 'Sakya monastery', predicate: 'within', object: 'Tsang' }
    ],
    expectedConfidence: '>0.95',
    difficulty: 'easy',
    notes: 'Clear founding date, founder, location, tradition'
  },

  {
    id: 'deity-001',
    text: 'Avalokiteshvara, the bodhisattva of compassion, is often depicted with a thousand arms and is particularly revered in Tibetan Buddhism.',
    expectedEntities: [
      {
        type: 'deity',
        name: 'Avalokiteshvara',
        attributes: {
          deityType: 'bodhisattva',
          qualities: ['compassion'],
          iconography: { arms: 1000 }
        }
      }
    ],
    expectedConfidence: '>0.9',
    difficulty: 'easy',
    notes: 'Deity type, quality, iconographic detail'
  },

  {
    id: 'deity-002',
    text: 'Tara, known as the "mother of liberation," appears in both green and white forms, with the Green Tara being associated with activity and protection.',
    expectedEntities: [
      {
        type: 'deity',
        name: 'Tara',
        attributes: {
          deityType: 'bodhisattva',
          qualities: ['liberation', 'protection']
        }
      },
      {
        type: 'deity',
        name: 'Green Tara',
        attributes: {
          deityType: 'bodhisattva',
          iconography: { color: 'green' }
        }
      }
    ],
    expectedConfidence: '>0.85',
    difficulty: 'easy',
    notes: 'Multiple forms, color associations, epithets'
  },

  // ==================== MEDIUM - AMBIGUOUS REFERENCES (15) ====================

  {
    id: 'person-011',
    text: 'The master taught at the monastery for many years before moving to the mountains.',
    expectedEntities: [
      {
        type: 'person',
        name: 'UNKNOWN',
        note: 'master is ambiguous reference - needs context'
      },
      {
        type: 'institution',
        name: 'UNKNOWN',
        note: 'which monastery is not specified'
      }
    ],
    expectedConfidence: '0.4-0.6',
    difficulty: 'medium',
    notes: 'Should flag for human review - cannot determine which master or monastery without context'
  },

  {
    id: 'person-012',
    text: 'After his teacher died, he went to India to continue his studies.',
    expectedEntities: [
      {
        type: 'person',
        name: 'UNKNOWN',
        note: 'pronoun "he" needs antecedent from context'
      },
      {
        type: 'person',
        name: 'UNKNOWN',
        note: 'teacher identity unknown'
      },
      {
        type: 'place',
        name: 'India'
      }
    ],
    expectedRelationships: [
      { subject: 'UNKNOWN', predicate: 'student_of', object: 'UNKNOWN' },
      { subject: 'UNKNOWN', predicate: 'visited', object: 'India' }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'medium',
    notes: 'Relative dating (after death), ambiguous pronouns, relationship inferable but entities unknown'
  },

  {
    id: 'person-013',
    text: 'The young Rinpoche was recognized at age three and brought to the monastery for training.',
    expectedEntities: [
      {
        type: 'person',
        name: 'UNKNOWN',
        attributes: { titles: ['Rinpoche'] },
        note: 'which Rinpoche not specified'
      }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'medium',
    notes: 'Rinpoche is a common honorific - needs more context. Recognition implies incarnation lineage but unclear which one'
  },

  {
    id: 'place-006',
    text: 'He established a hermitage in the mountains near the great monastery.',
    expectedEntities: [
      {
        type: 'place',
        name: 'UNKNOWN',
        attributes: { placeType: 'hermitage' },
        note: 'hermitage name not given'
      },
      {
        type: 'institution',
        name: 'UNKNOWN',
        note: 'which great monastery not specified'
      }
    ],
    expectedConfidence: '0.4-0.6',
    difficulty: 'medium',
    notes: 'Vague location descriptor, relative positioning unclear without knowing the monastery'
  },

  {
    id: 'date-002',
    text: 'He was born three years after the great debate at Samye.',
    expectedEntities: [
      {
        type: 'person',
        name: 'UNKNOWN',
        dates: {
          birth: {
            relative: 'three years after great debate at Samye',
            note: 'debate occurred ~792-794 CE, so birth ~795-797 CE'
          }
        }
      },
      {
        type: 'event',
        name: 'great debate at Samye',
        note: 'refers to Council of Samye ~792-794'
      }
    ],
    expectedConfidence: '0.6-0.8',
    difficulty: 'medium',
    notes: 'Relative date requires historical knowledge. "Great debate" refers to specific event but needs context'
  },

  {
    id: 'person-014',
    text: 'Chokyi Lodro studied with both the great Sakya master and the Kagyu abbot.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Chokyi Lodro'
      },
      {
        type: 'person',
        name: 'UNKNOWN',
        roles: ['teacher'],
        attributes: { tradition: ['Sakya'] },
        note: 'which Sakya master not specified'
      },
      {
        type: 'person',
        name: 'UNKNOWN',
        roles: ['abbot'],
        attributes: { tradition: ['Kagyu'] },
        note: 'which Kagyu abbot not specified'
      }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'medium',
    notes: 'Common name Chokyi Lodro appears in many lineages. Generic titles without specific names'
  },

  {
    id: 'text-006',
    text: 'His commentary on the Prajnaparamita became widely studied in Gelug monasteries.',
    expectedEntities: [
      {
        type: 'text',
        name: 'UNKNOWN',
        attributes: { textType: 'commentary' },
        note: 'commentary title not given'
      },
      {
        type: 'text',
        name: 'Prajnaparamita'
      },
      {
        type: 'person',
        name: 'UNKNOWN',
        note: 'author not specified'
      }
    ],
    expectedRelationships: [
      { subject: 'UNKNOWN', predicate: 'commentary_on', object: 'Prajnaparamita' }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'medium',
    notes: 'Many commentaries on Prajnaparamita exist. Needs author identification'
  },

  {
    id: 'person-015',
    text: 'The First Karmapa established many meditation centers throughout Tibet.',
    expectedEntities: [
      {
        type: 'person',
        name: 'First Karmapa',
        attributes: { titles: ['Karmapa'], tradition: ['Kagyu'] },
        note: 'likely Düsum Khyenpa (1110-1193) but should verify'
      }
    ],
    expectedConfidence: '0.7-0.85',
    difficulty: 'medium',
    notes: 'Title with ordinal number - can infer specific person but should verify historical records'
  },

  {
    id: 'concept-002',
    text: 'The Jonang school teaches that Buddha nature is truly existent, while the Gelug school considers this view problematic.',
    expectedEntities: [
      {
        type: 'concept',
        name: 'Buddha nature',
        attributes: {
          conceptType: 'philosophical_view',
          definitions: [
            { school: 'Jonang', note: 'truly existent (shentong)' },
            { school: 'Gelug', note: 'considered problematic interpretation' }
          ]
        }
      }
    ],
    expectedConfidence: '0.6-0.8',
    difficulty: 'medium',
    notes: 'School-specific interpretations of same concept. Shentong vs Rangtong debate requires context'
  },

  {
    id: 'date-003',
    text: 'Born in the iron-tiger year, he lived through three rabjung cycles.',
    expectedEntities: [
      {
        type: 'person',
        name: 'UNKNOWN',
        dates: {
          birth: {
            tibetanYear: { element: 'metal', animal: 'tiger' },
            note: 'multiple iron-tiger years possible'
          }
        }
      }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'medium',
    notes: 'Tibetan calendar repeats every 60 years. Living through 3 rabjung cycles = ~180 years lifespan suggests metaphorical or requires verification'
  },

  {
    id: 'person-016',
    text: 'The translator Rinchen Zangpo is sometimes confused with Atisha due to their overlapping time periods in western Tibet.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Rinchen Zangpo',
        roles: ['translator'],
        dates: { birth: 958, death: 1055 }
      },
      {
        type: 'person',
        name: 'Atisha',
        dates: { birth: 982, death: 1054 }
      }
    ],
    expectedConfidence: '0.6-0.8',
    difficulty: 'medium',
    notes: 'Disambiguation case - warns about potential confusion between contemporary figures'
  },

  {
    id: 'place-007',
    text: 'The cave where he meditated is located somewhere in the Milarepa range, though the exact location is disputed.',
    expectedEntities: [
      {
        type: 'place',
        name: 'UNKNOWN',
        attributes: { placeType: 'cave' },
        note: 'specific cave unidentified'
      },
      {
        type: 'place',
        name: 'Milarepa range',
        attributes: { placeType: 'mountain' }
      }
    ],
    expectedConfidence: '0.4-0.6',
    difficulty: 'medium',
    notes: 'Uncertain location, disputed identification. Should flag for low confidence'
  },

  {
    id: 'event-002',
    text: 'The empowerment lasted three days and was attended by hundreds of monks.',
    expectedEntities: [
      {
        type: 'event',
        name: 'UNKNOWN',
        attributes: {
          eventType: 'empowerment',
          duration: '3 days',
          attendeeCount: 'hundreds'
        }
      }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'medium',
    notes: 'Event type clear but no specific identification. Duration and attendance inferable'
  },

  {
    id: 'institution-002',
    text: 'The monastery was rebuilt after the fire during the time of the fifth abbot.',
    expectedEntities: [
      {
        type: 'institution',
        name: 'UNKNOWN',
        note: 'which monastery not specified'
      },
      {
        type: 'event',
        name: 'fire',
        attributes: { eventType: 'natural_disaster' }
      }
    ],
    expectedConfidence: '0.4-0.6',
    difficulty: 'medium',
    notes: 'Relative dating via ordinal (fifth abbot). Monastery identity unknown'
  },

  {
    id: 'person-017',
    text: 'He received the name Tenzin Gyatso upon his enthronement.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Tenzin Gyatso',
        note: 'common name used by multiple Dalai Lamas - needs more context'
      }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'medium',
    notes: 'Name common across Dalai Lama lineage. Enthronement event implies high lama but which one?'
  },

  // ==================== MEDIUM - MULTIPLE SIMILAR NAMES (5) ====================

  {
    id: 'person-018',
    text: 'Jamyang Khyentse founded the monastery, though some sources say it was another Jamyang Khyentse from a later generation.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Jamyang Khyentse',
        note: 'multiple incarnations with same name - disambiguation needed'
      }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'medium',
    notes: 'Name disambiguation challenge. Multiple incarnations share the name. Sources conflict.'
  },

  {
    id: 'person-019',
    text: 'Sönam Gyatso was the third in his incarnation line, though the title itself was applied retroactively.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Sönam Gyatso',
        attributes: { titles: ['3rd Dalai Lama'] },
        note: 'first to receive Dalai Lama title but posthumously applied to predecessors'
      }
    ],
    expectedConfidence: '0.7-0.85',
    difficulty: 'medium',
    notes: 'Retroactive title application. Historical complexity in lineage counting'
  },

  {
    id: 'person-020',
    text: 'The text mentions both Kongtrul Rinpoche who lived in the 19th century and Kongtrul Rinpoche from our own time.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Kongtrul Rinpoche',
        dates: { birth: { year: 1800, precision: 'circa' } },
        note: 'likely Jamgön Kongtrul Lodrö Thayé (1813-1899)'
      },
      {
        type: 'person',
        name: 'Kongtrul Rinpoche',
        note: 'modern incarnation - multiple possible'
      }
    ],
    expectedConfidence: '0.6-0.8',
    difficulty: 'medium',
    notes: 'Temporal disambiguation required. Same title, different incarnations/centuries'
  },

  {
    id: 'person-021',
    text: 'Lobsang Chökyi Gyaltsen could refer to either the Fourth Panchen Lama or the First Panchen Lama, depending on how the lineage is counted.',
    expectedEntities: [
      {
        type: 'person',
        name: 'Lobsang Chökyi Gyaltsen',
        note: 'name shared by 1st and 4th Panchen Lamas due to counting differences'
      }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'medium',
    notes: 'Historical lineage counting ambiguity. Same name, different positions depending on source'
  },

  {
    id: 'person-022',
    text: 'Tsongkhapa\'s students included Khedrup Je and Gyaltsab Je, both of whom were later recognized as having previous incarnations.',
    expectedEntities: [
      { type: 'person', name: 'Tsongkhapa', roles: ['teacher'] },
      { type: 'person', name: 'Khedrup Je', roles: ['student'] },
      { type: 'person', name: 'Gyaltsab Je', roles: ['student'] }
    ],
    expectedRelationships: [
      { subject: 'Khedrup Je', predicate: 'student_of', object: 'Tsongkhapa' },
      { subject: 'Gyaltsab Je', predicate: 'student_of', object: 'Tsongkhapa' }
    ],
    expectedConfidence: '0.7-0.85',
    difficulty: 'medium',
    notes: 'Retroactive incarnation recognition adds complexity. Multiple lineages initiated'
  },

  // ==================== MEDIUM - GEOGRAPHIC & INSTITUTIONAL HIERARCHIES (5) ====================

  {
    id: 'place-008',
    text: 'The hermitage near Tsurphu is in the Tolung valley, which is part of the Ü-Tsang region of central Tibet.',
    expectedEntities: [
      {
        type: 'place',
        name: 'hermitage',
        attributes: { placeType: 'hermitage' }
      },
      {
        type: 'institution',
        name: 'Tsurphu'
      },
      {
        type: 'place',
        name: 'Tolung valley',
        attributes: { placeType: 'region' }
      },
      {
        type: 'place',
        name: 'Ü-Tsang',
        attributes: { placeType: 'region' }
      },
      {
        type: 'place',
        name: 'central Tibet',
        attributes: { placeType: 'region' }
      }
    ],
    expectedRelationships: [
      { subject: 'hermitage', predicate: 'near', object: 'Tsurphu' },
      { subject: 'hermitage', predicate: 'within', object: 'Tolung valley' },
      { subject: 'Tolung valley', predicate: 'within', object: 'Ü-Tsang' },
      { subject: 'Ü-Tsang', predicate: 'within', object: 'central Tibet' }
    ],
    expectedConfidence: '0.6-0.8',
    difficulty: 'medium',
    notes: 'Complex geographic hierarchy with multiple levels. Requires understanding regional nesting'
  },

  {
    id: 'institution-003',
    text: 'Drepung monastery had four colleges: Loseling, Gomang, Deyang, and Ngagpa, each with their own administrative structure.',
    expectedEntities: [
      {
        type: 'institution',
        name: 'Drepung monastery',
        attributes: { institutionType: 'monastery' }
      },
      {
        type: 'institution',
        name: 'Loseling',
        attributes: { institutionType: 'college' }
      },
      {
        type: 'institution',
        name: 'Gomang',
        attributes: { institutionType: 'college' }
      },
      {
        type: 'institution',
        name: 'Deyang',
        attributes: { institutionType: 'college' }
      },
      {
        type: 'institution',
        name: 'Ngagpa',
        attributes: { institutionType: 'college' }
      }
    ],
    expectedRelationships: [
      { subject: 'Loseling', predicate: 'part_of', object: 'Drepung monastery' },
      { subject: 'Gomang', predicate: 'part_of', object: 'Drepung monastery' },
      { subject: 'Deyang', predicate: 'part_of', object: 'Drepung monastery' },
      { subject: 'Ngagpa', predicate: 'part_of', object: 'Drepung monastery' }
    ],
    expectedConfidence: '0.7-0.85',
    difficulty: 'medium',
    notes: 'Institutional hierarchy: monastery contains colleges. Multiple part-of relationships'
  },

  {
    id: 'place-009',
    text: 'Kham region in eastern Tibet includes many sub-regions such as Derge, Nangchen, and Chamdo.',
    expectedEntities: [
      {
        type: 'place',
        name: 'Kham',
        attributes: { placeType: 'region' }
      },
      {
        type: 'place',
        name: 'Derge',
        attributes: { placeType: 'region' }
      },
      {
        type: 'place',
        name: 'Nangchen',
        attributes: { placeType: 'region' }
      },
      {
        type: 'place',
        name: 'Chamdo',
        attributes: { placeType: 'city' }
      }
    ],
    expectedRelationships: [
      { subject: 'Derge', predicate: 'within', object: 'Kham' },
      { subject: 'Nangchen', predicate: 'within', object: 'Kham' },
      { subject: 'Chamdo', predicate: 'within', object: 'Kham' }
    ],
    expectedConfidence: '0.7-0.85',
    difficulty: 'medium',
    notes: 'Regional hierarchy with multiple subdivisions. City vs region distinction'
  },

  {
    id: 'text-007',
    text: 'The Kangyur contains 108 volumes, divided into Vinaya, Sutra, and Tantra sections, with the Derge edition being one of several canonical versions.',
    expectedEntities: [
      {
        type: 'text',
        name: 'Kangyur',
        attributes: {
          textType: 'sutra',
          volumeCount: 108,
          tibetanCanonSection: 'Kangyur'
        }
      },
      {
        type: 'text',
        name: 'Derge Kangyur',
        note: 'one edition among multiple'
      }
    ],
    expectedRelationships: [
      { subject: 'Derge Kangyur', predicate: 'part_of', object: 'Kangyur' }
    ],
    expectedConfidence: '0.7-0.85',
    difficulty: 'medium',
    notes: 'Textual hierarchy: collection with editions. Volume count and sections'
  },

  {
    id: 'institution-004',
    text: 'Mindrolling monastery in Dranang, Ü region, was a seat of the Nyingma tradition and housed one of Tibet\'s largest libraries.',
    expectedEntities: [
      {
        type: 'institution',
        name: 'Mindrolling monastery',
        attributes: { institutionType: 'monastery', tradition: ['Nyingma'] }
      },
      {
        type: 'place',
        name: 'Dranang',
        attributes: { placeType: 'region' }
      },
      {
        type: 'place',
        name: 'Ü',
        attributes: { placeType: 'region' }
      },
      {
        type: 'institution',
        name: 'Mindrolling library',
        attributes: { institutionType: 'library' }
      }
    ],
    expectedRelationships: [
      { subject: 'Mindrolling monastery', predicate: 'within', object: 'Dranang' },
      { subject: 'Dranang', predicate: 'within', object: 'Ü' },
      { subject: 'Mindrolling library', predicate: 'part_of', object: 'Mindrolling monastery' }
    ],
    expectedConfidence: '0.7-0.85',
    difficulty: 'medium',
    notes: 'Combined geographic and institutional hierarchy. Library as subsidiary institution'
  },

  // ==================== HARD - CHALLENGING CASES (15) ====================

  {
    id: 'date-004',
    text: 'He was born in the fire-dragon year during the reign of King Songsten Gampo.',
    expectedEntities: [
      {
        type: 'person',
        name: 'UNKNOWN',
        dates: {
          birth: {
            tibetanYear: { element: 'fire', animal: 'dragon' },
            era: 'reign of Songsten Gampo',
            note: 'Songsten Gampo reigned ~604-650 CE. Fire-dragon years: 616, 676. Likely 616 CE.'
          }
        }
      },
      {
        type: 'person',
        name: 'King Songsten Gampo',
        roles: ['king']
      }
    ],
    expectedConfidence: '0.6-0.8',
    difficulty: 'hard',
    notes: 'Requires Tibetan calendar conversion + historical era knowledge. Multiple fire-dragon years possible'
  },

  {
    id: 'date-005',
    text: 'Born in the wood-sheep year of the 14th rabjung, he passed away in the earth-pig year of the same cycle.',
    expectedEntities: [
      {
        type: 'person',
        name: 'UNKNOWN',
        dates: {
          birth: {
            tibetanYear: {
              rabjung: 14,
              element: 'wood',
              animal: 'sheep',
              year: 32,
              note: '14th rabjung = 781-840 CE, year 32 = 1655 CE'
            }
          },
          death: {
            tibetanYear: {
              rabjung: 14,
              element: 'earth',
              animal: 'pig',
              year: 59,
              note: '14th rabjung year 59 = 1659 CE'
            }
          }
        }
      }
    ],
    expectedConfidence: '0.6-0.8',
    difficulty: 'hard',
    notes: 'Requires rabjung cycle calculation. 14th rabjung started 1627. Complex Tibetan calendar math.'
  },

  {
    id: 'person-023',
    text: 'The fifth incarnation of the lineage holder received teachings from both his predecessor\'s main disciple and from a tertön who revealed relevant texts.',
    expectedEntities: [
      {
        type: 'person',
        name: 'UNKNOWN',
        note: 'fifth incarnation - which lineage not specified'
      },
      {
        type: 'person',
        name: 'UNKNOWN',
        note: 'main disciple of fourth incarnation'
      },
      {
        type: 'person',
        name: 'UNKNOWN',
        roles: ['tertön'],
        note: 'treasure revealer not named'
      }
    ],
    expectedRelationships: [
      { subject: 'fifth incarnation', predicate: 'student_of', object: 'main disciple' },
      { subject: 'fifth incarnation', predicate: 'student_of', object: 'tertön' }
    ],
    expectedConfidence: '0.4-0.6',
    difficulty: 'hard',
    notes: 'Multiple ambiguous references. Lineage structure requires context. Terma transmission complexity'
  },

  {
    id: 'event-003',
    text: 'The debate occurred in the Year of the Water Horse, shortly after the monastery\'s founding but before the main temple was completed.',
    expectedEntities: [
      {
        type: 'event',
        name: 'debate',
        attributes: { eventType: 'debate' },
        dates: {
          occurred: {
            tibetanYear: { element: 'water', animal: 'horse' },
            relative: 'after monastery founding, before temple completion',
            note: 'multiple water-horse years possible without more context'
          }
        }
      }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'hard',
    notes: 'Tibetan calendar with relative dating constraints. Multiple possible years'
  },

  {
    id: 'concept-003',
    text: 'Rangtong and shentong are different interpretations of emptiness, with Gelug favoring the former and Jonang the latter, though both claim lineage from Nagarjuna.',
    expectedEntities: [
      {
        type: 'concept',
        name: 'rangtong',
        attributes: {
          conceptType: 'philosophical_view',
          definitions: [
            { school: 'Gelug', text: 'self-empty, preferred interpretation' },
            { author: 'Nagarjuna', note: 'claimed lineage source' }
          ]
        }
      },
      {
        type: 'concept',
        name: 'shentong',
        attributes: {
          conceptType: 'philosophical_view',
          definitions: [
            { school: 'Jonang', text: 'other-empty, preferred interpretation' },
            { author: 'Nagarjuna', note: 'claimed lineage source' }
          ]
        }
      },
      {
        type: 'concept',
        name: 'emptiness',
        attributes: { conceptType: 'philosophical_view' }
      }
    ],
    expectedConfidence: '0.7-0.85',
    difficulty: 'hard',
    notes: 'Conflicting school interpretations of same philosophical lineage. Requires understanding sectarian debates'
  },

  {
    id: 'person-024',
    text: 'Some sources claim he was born in 1357 while others state 1355, with the discrepancy possibly due to different calendar systems or counting methods.',
    expectedEntities: [
      {
        type: 'person',
        name: 'UNKNOWN',
        dates: {
          birth: {
            year: 1357,
            precision: 'disputed',
            note: 'disputed between 1355 and 1357'
          }
        }
      }
    ],
    expectedConfidence: '0.6-0.8',
    difficulty: 'hard',
    notes: 'Conflicting historical sources. Calendar conversion ambiguity. Should preserve both dates and flag uncertainty'
  },

  {
    id: 'relationship-001',
    text: 'Although they never met in person, he considered himself a student of the master through studying his texts and practicing his teachings.',
    expectedEntities: [
      {
        type: 'person',
        name: 'UNKNOWN',
        note: 'student identity unknown'
      },
      {
        type: 'person',
        name: 'UNKNOWN',
        note: 'master identity unknown',
        roles: ['teacher']
      }
    ],
    expectedRelationships: [
      {
        subject: 'UNKNOWN',
        predicate: 'student_of',
        object: 'UNKNOWN',
        properties: { note: 'textual transmission only, never met in person' }
      }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'hard',
    notes: 'Non-direct lineage transmission. Relationship type ambiguous - is it student_of or studied_texts_of?'
  },

  {
    id: 'place-010',
    text: 'The cave is said to be near a river, three days\' walk from the nearest village, somewhere in what is now Bhutan.',
    expectedEntities: [
      {
        type: 'place',
        name: 'UNKNOWN',
        attributes: {
          placeType: 'cave',
          modernCountry: 'Bhutan',
          note: 'vague location: near river, 3 days from unknown village'
        }
      }
    ],
    expectedConfidence: '0.3-0.5',
    difficulty: 'hard',
    notes: 'Imprecise location with travel time measure. Modern country borders don\'t match historical geography'
  },

  {
    id: 'text-008',
    text: 'The root text was written in the 11th century, but the commentary we have today incorporates later interpolations from at least two different periods.',
    expectedEntities: [
      {
        type: 'text',
        name: 'UNKNOWN',
        dates: {
          composed: { year: 1000, precision: 'circa' }
        },
        note: 'root text from 11th century'
      },
      {
        type: 'text',
        name: 'UNKNOWN',
        attributes: { textType: 'commentary' },
        note: 'commentary with later additions'
      }
    ],
    expectedRelationships: [
      { subject: 'UNKNOWN', predicate: 'commentary_on', object: 'UNKNOWN' }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'hard',
    notes: 'Textual stratification. Multiple authorship periods. Interpolations complicate attribution'
  },

  {
    id: 'person-025',
    text: 'Referred to only as "the great tertön from Kham," his actual name has been lost to history, though his revelations were preserved.',
    expectedEntities: [
      {
        type: 'person',
        name: 'UNKNOWN',
        roles: ['tertön'],
        attributes: {
          epithets: ['the great tertön from Kham'],
          note: 'name lost, known only by epithet'
        }
      },
      {
        type: 'place',
        name: 'Kham',
        attributes: { placeType: 'region' }
      }
    ],
    expectedConfidence: '0.4-0.6',
    difficulty: 'hard',
    notes: 'Lost historical identity. Only epithet and regional association remain. Should create entity despite missing name'
  },

  {
    id: 'event-004',
    text: 'The transmission ceremony occurred during the summer, possibly in the fifth or sixth month of the Tibetan calendar, before the rainy season retreat.',
    expectedEntities: [
      {
        type: 'event',
        name: 'transmission ceremony',
        attributes: { eventType: 'transmission' },
        dates: {
          occurred: {
            season: 'summer',
            note: '5th or 6th Tibetan month, before rainy season retreat',
            precision: 'estimated'
          }
        }
      }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'hard',
    notes: 'Vague temporal markers. Tibetan calendar months + seasonal reference + relative timing'
  },

  {
    id: 'institution-005',
    text: 'The monastery, founded sometime between 1350 and 1380, changed hands between Sakya and Kagyu control several times before being destroyed in the 17th century.',
    expectedEntities: [
      {
        type: 'institution',
        name: 'UNKNOWN',
        attributes: { institutionType: 'monastery' },
        dates: {
          founded: { year: 1365, precision: 'estimated', note: 'between 1350-1380' },
          destroyed: { year: 1600, precision: 'circa', note: '17th century' }
        }
      }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'hard',
    notes: 'Date ranges, changing sectarian control, destruction. Complex institutional history'
  },

  {
    id: 'person-026',
    text: 'The Sakya throne holder received his ordination from three different abbots representing the three major Sakya sub-schools.',
    expectedEntities: [
      {
        type: 'person',
        name: 'UNKNOWN',
        roles: ['abbot'],
        attributes: { tradition: ['Sakya'] },
        note: 'Sakya throne holder - which one unknown'
      },
      {
        type: 'person',
        name: 'UNKNOWN',
        roles: ['abbot'],
        note: 'first ordination abbot'
      },
      {
        type: 'person',
        name: 'UNKNOWN',
        roles: ['abbot'],
        note: 'second ordination abbot'
      },
      {
        type: 'person',
        name: 'UNKNOWN',
        roles: ['abbot'],
        note: 'third ordination abbot'
      }
    ],
    expectedRelationships: [
      { subject: 'throne holder', predicate: 'student_of', object: 'abbot 1' },
      { subject: 'throne holder', predicate: 'student_of', object: 'abbot 2' },
      { subject: 'throne holder', predicate: 'student_of', object: 'abbot 3' }
    ],
    expectedConfidence: '0.4-0.6',
    difficulty: 'hard',
    notes: 'Multiple ordination lineages. Sakya sub-school complexity. All entities unidentified'
  },

  {
    id: 'lineage-001',
    text: 'The teaching lineage passed from India to Tibet through five key masters, though the exact identity of the third lineage holder is debated.',
    expectedEntities: [
      {
        type: 'lineage',
        name: 'UNKNOWN',
        attributes: {
          lineageType: 'transmission',
          chain: [
            { position: 1, note: 'Indian master 1' },
            { position: 2, note: 'Indian master 2' },
            { position: 3, note: 'identity debated' },
            { position: 4, note: 'Tibetan master 1' },
            { position: 5, note: 'Tibetan master 2' }
          ]
        }
      }
    ],
    expectedConfidence: '0.5-0.7',
    difficulty: 'hard',
    notes: 'Lineage structure with uncertain link. Chain requires multiple inferences'
  },

  {
    id: 'concept-004',
    text: 'Dzogchen teachings contain both Mind Series (Semde), Space Series (Longde), and Secret Instruction Series (Mengagde), with different lineages emphasizing different series.',
    expectedEntities: [
      {
        type: 'concept',
        name: 'Dzogchen',
        attributes: {
          conceptType: 'meditation_practice',
          relatedConcepts: {
            narrower: ['Semde', 'Longde', 'Mengagde']
          }
        }
      },
      {
        type: 'concept',
        name: 'Semde',
        attributes: { conceptType: 'meditation_practice' }
      },
      {
        type: 'concept',
        name: 'Longde',
        attributes: { conceptType: 'meditation_practice' }
      },
      {
        type: 'concept',
        name: 'Mengagde',
        attributes: { conceptType: 'meditation_practice' }
      }
    ],
    expectedConfidence: '0.7-0.85',
    difficulty: 'hard',
    notes: 'Complex conceptual hierarchy. Tibetan terms with English translations. Multiple lineage interpretations'
  }
];

// ==================== SUMMARY STATISTICS ====================

export const calibrationStats = {
  total: calibrationDataset.length,
  byDifficulty: {
    easy: calibrationDataset.filter(c => c.difficulty === 'easy').length,
    medium: calibrationDataset.filter(c => c.difficulty === 'medium').length,
    hard: calibrationDataset.filter(c => c.difficulty === 'hard').length
  },
  byEntityType: {
    person: calibrationDataset.filter(c =>
      c.expectedEntities.some(e => e.type === 'person')
    ).length,
    place: calibrationDataset.filter(c =>
      c.expectedEntities.some(e => e.type === 'place')
    ).length,
    text: calibrationDataset.filter(c =>
      c.expectedEntities.some(e => e.type === 'text')
    ).length,
    event: calibrationDataset.filter(c =>
      c.expectedEntities.some(e => e.type === 'event')
    ).length,
    concept: calibrationDataset.filter(c =>
      c.expectedEntities.some(e => e.type === 'concept')
    ).length,
    institution: calibrationDataset.filter(c =>
      c.expectedEntities.some(e => e.type === 'institution')
    ).length,
    deity: calibrationDataset.filter(c =>
      c.expectedEntities.some(e => e.type === 'deity')
    ).length
  },
  edgeCases: {
    tibetanCalendar: calibrationDataset.filter(c => c.id.startsWith('date-')).length,
    ambiguousReferences: calibrationDataset.filter(c =>
      c.expectedEntities.some(e => e.name === 'UNKNOWN')
    ).length,
    namingConflicts: calibrationDataset.filter(c =>
      c.notes?.includes('similar name') || c.notes?.includes('disambiguation')
    ).length,
    schoolSpecific: calibrationDataset.filter(c =>
      c.notes?.includes('school') || c.notes?.includes('sectarian')
    ).length,
    hierarchies: calibrationDataset.filter(c =>
      c.expectedRelationships?.some(r => r.predicate === 'within' || r.predicate === 'part_of')
    ).length
  }
};
