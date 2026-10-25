import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  featureLabel,
  isActiveStatus,
  parseTaskMetadata,
  progressPercent,
  statusLabel,
  taskDestination,
  timeAgo,
  type TaskRecord,
} from '../libs/tasks';

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 't1',
    feature: 'chat_response',
    status: 'completed',
    progress: 100,
    metadata: null,
    createdAt: '2026-10-25T10:00:00.000Z',
    updatedAt: '2026-10-25T10:00:05.000Z',
    ...overrides,
  };
}

test('features have plain names, unknown ones fall back to Task', () => {
  assert.equal(featureLabel('chat_response'), 'Chat');
  assert.equal(featureLabel('image_generation'), 'Image');
  assert.equal(featureLabel('voice_processing'), 'Voice');
  assert.equal(featureLabel('voice_clone'), 'Voice clone');
  assert.equal(featureLabel('voice_registration'), 'Voice profile');
  assert.equal(featureLabel('face_processing'), 'Face');
  assert.equal(featureLabel('document_ingestion'), 'Document');
  assert.equal(featureLabel('something_new'), 'Task');
});

test('statuses have plain names, an unknown status is never presented as working or done', () => {
  assert.equal(statusLabel('queued'), 'Waiting');
  assert.equal(statusLabel('processing'), 'Working');
  assert.equal(statusLabel('completed'), 'Done');
  assert.equal(statusLabel('failed'), 'Did not finish');
  assert.equal(statusLabel('canceled'), 'Canceled');
  assert.equal(statusLabel('archived-ish'), 'Unknown');
});

test('only queued and processing tasks are active', () => {
  assert.equal(isActiveStatus('queued'), true);
  assert.equal(isActiveStatus('processing'), true);
  for (const status of ['completed', 'failed', 'canceled', 'weird']) {
    assert.equal(isActiveStatus(status), false, status);
  }
});

test('progress is a whole percentage between 0 and 100', () => {
  assert.equal(progressPercent(task({ progress: 35 })), 35);
  assert.equal(progressPercent(task({ progress: -4 })), 0);
  assert.equal(progressPercent(task({ progress: 250 })), 100);
  assert.equal(progressPercent(task({ progress: 12.7 })), 13);
  assert.equal(progressPercent(task({ progress: Number.NaN })), 0);
});

test('metadata that is missing, broken or not an object is an empty object', () => {
  assert.deepEqual(parseTaskMetadata(null), {});
  assert.deepEqual(parseTaskMetadata(undefined), {});
  assert.deepEqual(parseTaskMetadata('{not json'), {});
  assert.deepEqual(parseTaskMetadata('[1,2]'), {});
  assert.deepEqual(parseTaskMetadata('"text"'), {});
  assert.deepEqual(parseTaskMetadata('{"chatId":"c1"}'), { chatId: 'c1' });
});

test('a chat task opens its chat', () => {
  const chatTask = task({ metadata: JSON.stringify({ chatId: 'chat 1' }) });
  assert.equal(taskDestination(chatTask), '/features/chats/chat%201');
});

test('a chat task without a usable chat id opens nothing', () => {
  assert.equal(taskDestination(task({ metadata: null })), null);
  assert.equal(taskDestination(task({ metadata: JSON.stringify({ chatId: 42 }) })), null);
  assert.equal(taskDestination(task({ metadata: JSON.stringify({ chatId: '' }) })), null);
});

test('tasks of features that have no mobile screen yet open nothing', () => {
  for (const feature of ['image_generation', 'voice_processing', 'face_processing', 'unknown']) {
    assert.equal(taskDestination(task({ feature })), null, feature);
  }
});

test('age is stated in plain units and never negative', () => {
  const now = Date.UTC(2026, 9, 25, 12, 0, 0);
  const ago = (ms: number) => new Date(now - ms).toISOString();
  assert.equal(timeAgo(ago(5_000), now), 'Just now');
  assert.equal(timeAgo(ago(59_000), now), 'Just now');
  assert.equal(timeAgo(ago(60_000), now), '1 min ago');
  assert.equal(timeAgo(ago(59 * 60_000), now), '59 min ago');
  assert.equal(timeAgo(ago(60 * 60_000), now), '1 h ago');
  assert.equal(timeAgo(ago(23 * 3_600_000), now), '23 h ago');
  assert.equal(timeAgo(ago(24 * 3_600_000), now), '1 d ago');
  assert.equal(
    timeAgo(ago(-30_000), now),
    'Just now',
    'a clock a little ahead is not a negative age'
  );
});
