// Pure helpers for the profile and assistant-settings screens.

export const MAX_NAME_LENGTH = 100;
// Same cap as the backend (updatePreferences) for the free-text settings.
export const MAX_FREE_TEXT = 300;

export function nameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 1) return 'Enter your name.';
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `Your name can have at most ${MAX_NAME_LENGTH} characters.`;
  }
  return null;
}

export interface Preferences {
  tone: string;
  detail: string;
  techDepth: string;
  responseFormat: string;
  role: string;
  domain: string;
  goals: string;
  language: string;
}

export interface Choice {
  value: string;
  label: string;
}

// The fixed-choice settings; the server accepts only these values.
export const PREFERENCE_CHOICES: Record<
  'tone' | 'detail' | 'techDepth' | 'responseFormat',
  { title: string; options: Choice[] }
> = {
  tone: {
    title: 'Tone',
    options: [
      { value: 'casual', label: 'Casual' },
      { value: 'formal', label: 'Formal' },
    ],
  },
  detail: {
    title: 'Level of detail',
    options: [
      { value: 'concise', label: 'Short' },
      { value: 'detailed', label: 'Detailed' },
    ],
  },
  techDepth: {
    title: 'Technical depth',
    options: [
      { value: 'beginner', label: 'Beginner' },
      { value: 'intermediate', label: 'Intermediate' },
      { value: 'expert', label: 'Expert' },
    ],
  },
  responseFormat: {
    title: 'Answer format',
    options: [
      { value: 'prose', label: 'Paragraphs' },
      { value: 'bullets', label: 'Bullets' },
      { value: 'mixed', label: 'Mixed' },
    ],
  },
};

export const DEFAULT_PREFERENCES: Preferences = {
  tone: 'casual',
  detail: 'detailed',
  techDepth: 'intermediate',
  responseFormat: 'mixed',
  role: '',
  domain: '',
  goals: '',
  language: 'English',
};

const FIXED_KEYS = ['tone', 'detail', 'techDepth', 'responseFormat'] as const;
const TEXT_KEYS = ['role', 'domain', 'goals', 'language'] as const;

type RawPreferences = Partial<Record<keyof Preferences, string | null>> | null | undefined;

export function preferencesFromServer(raw: RawPreferences): Preferences {
  const result: Preferences = { ...DEFAULT_PREFERENCES };
  if (!raw) return result;
  for (const key of FIXED_KEYS) {
    const value = raw[key];
    const known = PREFERENCE_CHOICES[key].options.some((option) => option.value === value);
    if (typeof value === 'string' && known) result[key] = value;
  }
  for (const key of TEXT_KEYS) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim() !== '') result[key] = value;
    else if (key !== 'language') result[key] = '';
  }
  return result;
}

export function preferencesInput(prefs: Preferences): Preferences {
  const input = { ...prefs };
  for (const key of TEXT_KEYS) input[key] = prefs[key].trim().slice(0, MAX_FREE_TEXT);
  if (input.language === '') input.language = DEFAULT_PREFERENCES.language;
  return input;
}

export function arePreferencesEqual(a: Preferences, b: Preferences): boolean {
  const left = preferencesInput(a);
  const right = preferencesInput(b);
  return (Object.keys(left) as (keyof Preferences)[]).every((key) => left[key] === right[key]);
}

type Count = number | null | undefined;

// A count the server did not send is unknown (null), never shown as zero.
function wholeNumber(value: Count): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : null;
}

export function usageStats(
  me: {
    totalChats?: Count;
    totalMessages?: Count;
    totalVoiceJobs?: Count;
    totalDocuments?: Count;
  } | null
) {
  return {
    chats: wholeNumber(me?.totalChats),
    messages: wholeNumber(me?.totalMessages),
    voiceJobs: wholeNumber(me?.totalVoiceJobs),
    documents: wholeNumber(me?.totalDocuments),
  };
}
