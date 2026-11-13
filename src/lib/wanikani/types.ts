// WaniKani API v2, revision 20170710. Field names mirror the API exactly so responses can be used
// without mapping. Reference: https://docs.api.wanikani.com/20170710/

export type ISODate = string;

export interface Resource<T, O extends string = string> {
  id: number;
  object: O;
  url: string;
  data_updated_at: ISODate | null;
  data: T;
}

export interface Collection<T> {
  object: 'collection';
  url: string;
  pages: { next_url: string | null; previous_url: string | null; per_page: number };
  total_count: number;
  data_updated_at: ISODate | null;
  data: T[];
}

export interface Report<T> {
  object: 'report';
  url: string;
  data_updated_at: ISODate | null;
  data: T;
}

// --- User -------------------------------------------------------------------------------------

export interface User {
  id: string;
  username: string;
  level: number;
  profile_url: string;
  started_at: ISODate;
  current_vacation_started_at: ISODate | null;
  subscription: {
    active: boolean;
    /** `unknown` should be treated as `free`. */
    type: 'free' | 'recurring' | 'lifetime' | 'unknown';
    max_level_granted: number;
    period_ends_at: ISODate | null;
  };
  preferences: UserPreferences;
}

export interface UserPreferences {
  default_voice_actor_id: number;
  extra_study_autoplay_audio: boolean;
  lessons_autoplay_audio: boolean;
  lessons_batch_size: number;
  lessons_presentation_order: string;
  reviews_autoplay_audio: boolean;
  reviews_display_srs_indicator: boolean;
  reviews_presentation_order: 'shuffled' | 'lower_levels_first';
}

// --- Summary ----------------------------------------------------------------------------------

export interface Summary {
  lessons: { available_at: ISODate; subject_ids: number[] }[];
  next_reviews_at: ISODate | null;
  /** 25 hourly buckets: the first is "available now", then each following hour. */
  reviews: { available_at: ISODate; subject_ids: number[] }[];
}

// --- Assignments ------------------------------------------------------------------------------

export type SubjectType = 'radical' | 'kanji' | 'vocabulary' | 'kana_vocabulary';

export interface Assignment {
  created_at: ISODate;
  subject_id: number;
  subject_type: SubjectType;
  level?: number;
  srs_stage: number;
  unlocked_at: ISODate | null;
  started_at: ISODate | null;
  passed_at: ISODate | null;
  burned_at: ISODate | null;
  available_at: ISODate | null;
  resurrected_at: ISODate | null;
  hidden: boolean;
}

// --- Subjects ---------------------------------------------------------------------------------

export interface Meaning {
  meaning: string;
  primary: boolean;
  accepted_answer: boolean;
}

export interface AuxiliaryMeaning {
  meaning: string;
  type: 'whitelist' | 'blacklist';
}

export interface Reading {
  reading: string;
  primary: boolean;
  accepted_answer: boolean;
  /** Kanji only. */
  type?: 'onyomi' | 'kunyomi' | 'nanori';
}

export interface CharacterImage {
  url: string;
  content_type: string;
  metadata: Record<string, unknown>;
}

export interface PronunciationAudio {
  url: string;
  content_type: 'audio/mpeg' | 'audio/ogg' | 'audio/webm' | string;
  metadata: {
    gender: string;
    source_id: number;
    pronunciation: string;
    voice_actor_id: number;
    voice_actor_name: string;
    voice_description: string;
  };
}

export interface ContextSentence {
  en: string;
  ja: string;
}

interface SubjectBase {
  auxiliary_meanings: AuxiliaryMeaning[];
  characters: string | null;
  created_at: ISODate;
  document_url: string;
  hidden_at: ISODate | null;
  lesson_position: number;
  level: number;
  meaning_mnemonic: string;
  meanings: Meaning[];
  slug: string;
  spaced_repetition_system_id: number;
}

export interface RadicalData extends SubjectBase {
  amalgamation_subject_ids: number[];
  character_images: CharacterImage[];
}

export interface KanjiData extends SubjectBase {
  amalgamation_subject_ids: number[];
  component_subject_ids: number[];
  meaning_hint: string | null;
  reading_hint: string | null;
  reading_mnemonic: string;
  readings: Reading[];
  visually_similar_subject_ids: number[];
}

export interface VocabularyData extends SubjectBase {
  component_subject_ids: number[];
  context_sentences: ContextSentence[];
  parts_of_speech: string[];
  pronunciation_audios: PronunciationAudio[];
  readings: Reading[];
  reading_mnemonic: string;
}

export interface KanaVocabularyData extends SubjectBase {
  context_sentences: ContextSentence[];
  parts_of_speech: string[];
  pronunciation_audios: PronunciationAudio[];
}

export type Subject =
  | Resource<RadicalData, 'radical'>
  | Resource<KanjiData, 'kanji'>
  | Resource<VocabularyData, 'vocabulary'>
  | Resource<KanaVocabularyData, 'kana_vocabulary'>;

/** The union of every subject type's data, for code that reads optional fields generically. */
export type AnySubjectData = Partial<RadicalData & KanjiData & VocabularyData & KanaVocabularyData> &
  SubjectBase;

// --- Study materials --------------------------------------------------------------------------

export interface StudyMaterial {
  created_at: ISODate;
  subject_id: number;
  subject_type: SubjectType;
  meaning_note: string | null;
  reading_note: string | null;
  meaning_synonyms: string[];
  hidden: boolean;
}

// --- Reviews ----------------------------------------------------------------------------------

export interface CreateReviewBody {
  assignment_id: number;
  incorrect_meaning_answers: number;
  incorrect_reading_answers: number;
  created_at?: ISODate;
}

export interface ReviewResult {
  created_at: ISODate;
  assignment_id: number;
  spaced_repetition_system_id: number;
  subject_id: number;
  starting_srs_stage: number;
  ending_srs_stage: number;
  incorrect_meaning_answers: number;
  incorrect_reading_answers: number;
}

export interface CreateReviewResponse extends Resource<ReviewResult, 'review'> {
  resources_updated: {
    assignment: Resource<Assignment, 'assignment'>;
    review_statistic: Resource<unknown, 'review_statistic'>;
  };
}
