import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  MAX_PROMPT_LENGTH,
  base64FromDataUri,
  canGenerate,
  describeGenerationError,
  describeGenerationFailure,
  findRunningImageTaskId,
  keepUsableImages,
  restoreState,
  imageExtension,
  imageFileName,
  parseTaskImages,
  parseTaskPrompt,
} from '../libs/image-generation';

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

test('the prompt limit matches the backend', () => {
  assert.equal(MAX_PROMPT_LENGTH, 500);
});

test('a prompt can be sent when it has words and is not too long', () => {
  assert.equal(canGenerate('a red fox'), true);
  assert.equal(canGenerate('  a red fox  '), true);
  assert.equal(canGenerate(''), false);
  assert.equal(canGenerate('   \n  '), false);
  assert.equal(canGenerate('x'.repeat(500)), true);
  assert.equal(canGenerate('x'.repeat(501)), false);
});

test('the limit counts the trimmed prompt, as the server will receive it', () => {
  assert.equal(canGenerate(`  ${'x'.repeat(500)}  `), true);
});

test('failures the user can act on get plain wording', () => {
  const quota = describeGenerationFailure('Daily image limit reached (20). Resets every 24h.');
  assert.match(quota.message, /today/i);
  assert.equal(quota.canRetry, false);

  const fast = describeGenerationFailure('Rate limit exceeded for variants.');
  assert.match(fast.message, /too quickly|wait/i);
  assert.equal(fast.canRetry, true);

  const tooLong = describeGenerationFailure('Prompt exceeds max length of 500');
  assert.match(tooLong.message, /too long/i);
  assert.equal(tooLong.canRetry, false);
});

test('any other server wording is replaced by a fixed sentence', () => {
  for (const raw of [
    'Pollinations API error: 502 Bad Gateway - upstream connect error',
    'prisma: connection pool timeout',
    undefined,
    null,
    '',
  ]) {
    const failure = describeGenerationFailure(raw);
    assert.equal(failure.canRetry, true);
    assert.doesNotMatch(failure.message, /pollinations|prisma|502|pool/i);
    assert.match(failure.message, /could not be created/i);
  }
});

test('file names are safe and recognisable', () => {
  assert.equal(imageFileName('A red Fox!', 0, 'jpg'), 'ai-image-a-red-fox-1.jpg');
  assert.equal(imageFileName('../../etc/passwd', 2, 'png'), 'ai-image-etc-passwd-3.png');
  assert.equal(imageFileName('', 3, 'jpg'), 'ai-image-4.jpg');
  assert.equal(imageFileName('😀😀', 0, 'jpg'), 'ai-image-1.jpg');
  assert.ok(imageFileName('x'.repeat(300), 0, 'jpg').length <= 60);
});

test('the file extension follows the real image type', () => {
  assert.equal(imageExtension('data:image/png;base64,iVBOR'), 'png');
  assert.equal(imageExtension('data:image/jpeg;base64,/9j/'), 'jpg');
  assert.equal(imageExtension('data:image/webp;base64,UklGR'), 'webp');
  assert.equal(
    imageExtension('https://example.test/photo.png'),
    'jpg',
    'unknown types default to jpg'
  );
  assert.equal(
    imageExtension('data:image/svg+xml;base64,PHN2Zz4='),
    'jpg',
    'only known raster types are named by type'
  );
});

test('only base64 image data URIs yield data to save', () => {
  assert.equal(base64FromDataUri(JPEG), '/9j/4AAQSkZJRg==');
  assert.equal(base64FromDataUri('data:image/png;base64,iVBOR'), 'iVBOR');
  assert.equal(base64FromDataUri('https://example.test/a.jpg'), null);
  assert.equal(base64FromDataUri('data:text/html;base64,PGh0bWw+'), null);
  assert.equal(base64FromDataUri('data:image/jpeg,not-base64'), null);
  assert.equal(base64FromDataUri(''), null);
});

test('images are read back from a task, keeping only inline image data', () => {
  const metadata = JSON.stringify({
    prompt: 'a red fox',
    images: [
      JPEG,
      'https://cdn.example.test/a.jpg',
      'http://cdn.example.test/a.jpg',
      'javascript:alert(1)',
      'file:///data/secret.jpg',
      42,
      null,
      'data:text/html;base64,PGg+',
    ],
  });
  assert.deepEqual(parseTaskImages(metadata), [JPEG]);
});

test('images returned by the server are filtered the same way as restored ones', () => {
  assert.deepEqual(keepUsableImages([JPEG, 'https://x.test/a.jpg', 'javascript:1', 7, null]), [
    JPEG,
  ]);
  assert.deepEqual(keepUsableImages(undefined), []);
  assert.deepEqual(keepUsableImages(null), []);
  assert.equal(keepUsableImages([JPEG, JPEG, JPEG, JPEG, JPEG]).length, 4);
});

test('a task with no usable images gives an empty list, never an error', () => {
  assert.deepEqual(parseTaskImages(null), []);
  assert.deepEqual(parseTaskImages('{not json'), []);
  assert.deepEqual(parseTaskImages('{"images":"nope"}'), []);
  assert.deepEqual(parseTaskImages('{"prompt":"x"}'), []);
});

test('at most four images are read back', () => {
  const metadata = JSON.stringify({ images: [JPEG, JPEG, JPEG, JPEG, JPEG, JPEG] });
  assert.equal(parseTaskImages(metadata).length, 4);
});

test('the prompt is read back from a task', () => {
  assert.equal(parseTaskPrompt('{"prompt":"a red fox"}'), 'a red fox');
  assert.equal(parseTaskPrompt('{"prompt":42}'), '');
  assert.equal(parseTaskPrompt(null), '');
  assert.equal(parseTaskPrompt('oops'), '');
});

test('a request that never got an answer is a connection problem', () => {
  const failure = describeGenerationError(new TypeError('Network request failed'));
  assert.equal(failure.canRetry, true);
  assert.match(failure.message, /connection/i);
});

test('an error the server answered with is classified by its message, never shown raw', () => {
  const quota = describeGenerationError(
    Object.assign(new Error('x'), {
      errors: [{ message: 'Daily image limit reached (20). Resets every 24h.' }],
    })
  );
  assert.equal(quota.canRetry, false);

  const internal = describeGenerationError(
    Object.assign(new Error('x'), { errors: [{ message: 'prisma: pool timeout' }] })
  );
  assert.doesNotMatch(internal.message, /prisma|pool/i);
});

test('an HTTP error is not reported as a lost connection', () => {
  const failure = describeGenerationError(Object.assign(new Error('502'), { statusCode: 502 }));
  assert.doesNotMatch(failure.message, /connection/i);
  assert.equal(failure.canRetry, true);
});

const task = (overrides: Record<string, unknown> = {}) => ({
  id: 't1',
  feature: 'image_generation',
  status: 'completed',
  ...overrides,
});

test('without a task id there is nothing to restore', () => {
  assert.equal(
    restoreState({ taskId: undefined, task: null, error: false, loading: false }),
    'none'
  );
});

test('a task that is still being fetched is loading, never missing', () => {
  assert.equal(restoreState({ taskId: 't1', task: null, error: false, loading: true }), 'loading');
});

test('a task the server does not return is missing, so the screen stops waiting', () => {
  // Another user's id, a deleted task and a mistyped id all come back as null.
  assert.equal(restoreState({ taskId: 't1', task: null, error: false, loading: false }), 'missing');
  assert.equal(restoreState({ taskId: 't1', task: null, error: true, loading: false }), 'missing');
});

test('a task of another kind is not restored as an image', () => {
  assert.equal(
    restoreState({
      taskId: 't1',
      task: task({ feature: 'chat_response' }),
      error: false,
      loading: false,
    }),
    'missing'
  );
});

test('a running task is running, a finished one completed, an unsuccessful one failed', () => {
  const state = (status: string) =>
    restoreState({ taskId: 't1', task: task({ status }), error: false, loading: false });
  assert.equal(state('queued'), 'running');
  assert.equal(state('processing'), 'running');
  assert.equal(state('completed'), 'completed');
  assert.equal(state('failed'), 'failed');
  assert.equal(state('canceled'), 'failed');
});

test('a generation that is still running is found when the screen is opened again', () => {
  const now = Date.UTC(2026, 9, 25, 12, 0, 0);
  const recent = new Date(now - 30_000).toISOString();
  const tasks = [
    { id: 'chat', feature: 'chat_response', status: 'processing', updatedAt: recent },
    { id: 'done', feature: 'image_generation', status: 'completed', updatedAt: recent },
    { id: 'running', feature: 'image_generation', status: 'processing', updatedAt: recent },
  ];
  assert.equal(findRunningImageTaskId(tasks, now), 'running');
});

test('a running image task that has not moved for minutes is stale and is ignored', () => {
  const now = Date.UTC(2026, 9, 25, 12, 0, 0);
  const stale = new Date(now - 10 * 60_000).toISOString();
  assert.equal(
    findRunningImageTaskId(
      [{ id: 'stuck', feature: 'image_generation', status: 'processing', updatedAt: stale }],
      now
    ),
    null
  );
  assert.equal(findRunningImageTaskId([], now), null);
  assert.equal(findRunningImageTaskId(undefined, now), null);
});
