import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  MAX_TEXT_LENGTH,
  canProcessText,
  describeVoiceError,
  describeVoiceFailure,
} from '../libs/voice-tools';

test('the text limit matches the backend', () => {
  assert.equal(MAX_TEXT_LENGTH, 5000);
});

test('text can be processed when it has words and is not too long', () => {
  assert.equal(canProcessText('hello'), true);
  assert.equal(canProcessText('  hello  '), true);
  assert.equal(canProcessText(''), false);
  assert.equal(canProcessText('  \n '), false);
  assert.equal(canProcessText('x'.repeat(5000)), true);
  assert.equal(canProcessText('x'.repeat(5001)), false);
  assert.equal(canProcessText(`  ${'x'.repeat(5000)}  `), true, 'the trimmed text is what is sent');
});

test('the answers the user can act on get plain wording', () => {
  const tooLong = describeVoiceFailure('Text exceeds the maximum of 5000 characters.');
  assert.match(tooLong.message, /too long/i);
  assert.equal(tooLong.canRetry, false);

  const language = describeVoiceFailure('Invalid target language.');
  assert.match(language.message, /language/i);
  assert.equal(language.canRetry, false);
});

test('any other server wording is replaced by a fixed sentence', () => {
  for (const raw of [
    'prisma: pool timeout',
    'The text could not be processed. Please try again.',
    undefined,
    null,
    '',
  ]) {
    const failure = describeVoiceFailure(raw);
    assert.equal(failure.canRetry, true);
    assert.doesNotMatch(failure.message, /prisma|pool/i);
    assert.match(failure.message, /could not be processed/i);
  }
});

test('a request that never got an answer is a connection problem', () => {
  const failure = describeVoiceError(new TypeError('Network request failed'));
  assert.equal(failure.canRetry, true);
  assert.match(failure.message, /connection/i);
});

test('an error the server answered with is classified, never shown raw', () => {
  const failure = describeVoiceError(
    Object.assign(new Error('x'), { errors: [{ message: 'Variable "$input" got invalid value' }] })
  );
  assert.doesNotMatch(failure.message, /variable|input/i);
  assert.equal(failure.canRetry, true);
});

test('an HTTP error is not reported as a lost connection', () => {
  const failure = describeVoiceError(Object.assign(new Error('429'), { statusCode: 429 }));
  assert.doesNotMatch(failure.message, /connection/i);
  assert.equal(failure.canRetry, true);
});
