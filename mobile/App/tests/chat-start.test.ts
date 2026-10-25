import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  claimFirstMessage,
  describeSendFailure,
  releaseFirstMessage,
  titleFromMessage,
} from '../libs/chat-start';

test('a short message is its own title', () => {
  assert.equal(titleFromMessage('Plan my week'), 'Plan my week');
});

test('the title is trimmed and whitespace is collapsed', () => {
  assert.equal(titleFromMessage('  Plan\n\n my   week \t'), 'Plan my week');
});

test('a long message is cut to 40 characters and marked with an ellipsis, as on web', () => {
  const title = titleFromMessage('a'.repeat(60));
  assert.equal(title, `${'a'.repeat(40)}...`);
  assert.equal(titleFromMessage('a'.repeat(40)), 'a'.repeat(40));
});

test('cutting never splits an emoji in half', () => {
  const title = titleFromMessage('😀'.repeat(50));
  assert.equal(title, `${'😀'.repeat(40)}...`);
});

test('an empty message has no title, so the server default applies', () => {
  assert.equal(titleFromMessage('   '), undefined);
});

test('the first message of a chat can be claimed only once, even across remounts', () => {
  assert.equal(claimFirstMessage('chat-a'), true);
  assert.equal(claimFirstMessage('chat-a'), false);
  assert.equal(claimFirstMessage('chat-a'), false);
  assert.equal(claimFirstMessage('chat-b'), true);
});

test('a released claim can be taken again, other chats are untouched', () => {
  assert.equal(claimFirstMessage('chat-c'), true);
  releaseFirstMessage('chat-c');
  assert.equal(claimFirstMessage('chat-c'), true);
  assert.equal(claimFirstMessage('chat-b'), false);
});

test('a network failure is retryable and says so plainly', () => {
  const failure = describeSendFailure(new TypeError('Network request failed'));
  assert.equal(failure.canRetry, true);
  assert.match(failure.message, /connection/i);
});

test('an answer from the server is shown as its own message', () => {
  const serverError = Object.assign(new Error('Something broke'), {
    errors: [{ message: 'Something broke' }],
  });
  const failure = describeSendFailure(serverError);
  assert.equal(failure.canRetry, true);
  assert.equal(failure.message, 'Something broke');
});

test('a chat that no longer exists cannot be retried', () => {
  const missing = Object.assign(new Error('Chat not found'), {
    errors: [{ message: 'Chat not found', extensions: { code: 'BAD_USER_INPUT' } }],
  });
  const failure = describeSendFailure(missing);
  assert.equal(failure.canRetry, false);
  assert.match(failure.message, /no longer exists/i);
});

test('a server that failed internally gets fixed plain wording, never its raw text', () => {
  const internal = Object.assign(new Error('prisma: connection pool timeout'), {
    errors: [
      {
        message: 'prisma: connection pool timeout',
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      },
    ],
  });
  const failure = describeSendFailure(internal);
  assert.equal(failure.canRetry, true);
  assert.doesNotMatch(failure.message, /prisma|pool/i);
  assert.match(failure.message, /server/i);
});

test('an HTTP error from the server is not reported as a lost connection', () => {
  const rateLimited = Object.assign(
    new Error('Response not successful: Received status code 429'),
    {
      statusCode: 429,
    }
  );
  const failure = describeSendFailure(rateLimited);
  assert.equal(failure.canRetry, true);
  assert.doesNotMatch(failure.message, /connection/i);
  assert.match(failure.message, /try again/i);
});

test('anything unexpected still gives a retryable generic message', () => {
  const failure = describeSendFailure('boom');
  assert.equal(failure.canRetry, true);
  assert.ok(failure.message.length > 0);
});
