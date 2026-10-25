import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  DEFAULT_PREFERENCES,
  MAX_FREE_TEXT,
  MAX_NAME_LENGTH,
  arePreferencesEqual,
  nameProblem,
  preferencesFromServer,
  preferencesInput,
  usageStats,
} from '../libs/profile';

test('a name must have between 1 and 100 characters once trimmed', () => {
  assert.equal(nameProblem('Ada'), null);
  assert.equal(nameProblem('  Ada Lovelace  '), null);
  assert.equal(nameProblem('x'.repeat(MAX_NAME_LENGTH)), null);
  assert.match(String(nameProblem('')), /enter your name/i);
  assert.match(String(nameProblem('    ')), /enter your name/i);
  assert.match(String(nameProblem('x'.repeat(MAX_NAME_LENGTH + 1))), /100/);
});

test('missing or broken stored preferences become the defaults', () => {
  assert.deepEqual(preferencesFromServer(null), DEFAULT_PREFERENCES);
  assert.deepEqual(preferencesFromServer(undefined), DEFAULT_PREFERENCES);
  assert.deepEqual(preferencesFromServer({}), DEFAULT_PREFERENCES);
});

test('stored values are kept, and an unknown fixed choice falls back to its default', () => {
  const prefs = preferencesFromServer({
    tone: 'formal',
    detail: 'nonsense',
    techDepth: 'expert',
    responseFormat: null,
    role: 'Engineer',
    domain: null,
    goals: 'Ship it',
    language: 'French',
  });
  assert.equal(prefs.tone, 'formal');
  assert.equal(prefs.detail, DEFAULT_PREFERENCES.detail);
  assert.equal(prefs.techDepth, 'expert');
  assert.equal(prefs.responseFormat, DEFAULT_PREFERENCES.responseFormat);
  assert.equal(prefs.role, 'Engineer');
  assert.equal(prefs.domain, '');
  assert.equal(prefs.goals, 'Ship it');
  assert.equal(prefs.language, 'French');
});

test('the input sent to the server is trimmed and capped', () => {
  const input = preferencesInput({
    ...DEFAULT_PREFERENCES,
    role: '  Engineer  ',
    goals: 'g'.repeat(MAX_FREE_TEXT + 50),
  });
  assert.equal(input.role, 'Engineer');
  assert.equal(input.goals.length, MAX_FREE_TEXT);
  assert.deepEqual(Object.keys(input).sort(), Object.keys(DEFAULT_PREFERENCES).sort());
});

test('an empty language falls back to English so the assistant always has one', () => {
  assert.equal(preferencesInput({ ...DEFAULT_PREFERENCES, language: '   ' }).language, 'English');
});

test('two preference sets are equal when their trimmed values match', () => {
  assert.equal(arePreferencesEqual(DEFAULT_PREFERENCES, { ...DEFAULT_PREFERENCES }), true);
  assert.equal(
    arePreferencesEqual(DEFAULT_PREFERENCES, { ...DEFAULT_PREFERENCES, role: '  ' }),
    true,
    'blank and spaces are the same'
  );
  assert.equal(
    arePreferencesEqual(DEFAULT_PREFERENCES, { ...DEFAULT_PREFERENCES, tone: 'formal' }),
    false
  );
});

test('usage numbers are whole and never negative, and an unknown count stays unknown', () => {
  assert.deepEqual(
    usageStats({
      totalChats: 3,
      totalMessages: 12,
      totalVoiceJobs: null,
      totalDocuments: undefined,
    }),
    { chats: 3, messages: 12, voiceJobs: null, documents: null }
  );
  assert.deepEqual(
    usageStats({ totalChats: -4, totalMessages: 2.7, totalVoiceJobs: NaN, totalDocuments: 5 }),
    { chats: 0, messages: 3, voiceJobs: null, documents: 5 }
  );
});

test('before the counts load, none is shown as zero', () => {
  assert.deepEqual(usageStats(null), {
    chats: null,
    messages: null,
    voiceJobs: null,
    documents: null,
  });
});
