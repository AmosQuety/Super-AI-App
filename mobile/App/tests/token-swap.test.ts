import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mustSignInAgain, replaceTokenIfSessionUnchanged, TokenStore } from '../libs/token-swap';

function makeStore(initial: string | null, options: { failSet?: boolean } = {}) {
  let token = initial;
  const store: TokenStore = {
    get: async () => token,
    set: async (next) => {
      if (options.failSet) throw new Error('keychain unavailable');
      token = next;
    },
  };
  return { store, current: () => token, signOutNow: () => (token = null) };
}

test('stores the new token when this device still holds the token the request used', async () => {
  const { store, current } = makeStore('old');
  assert.equal(await replaceTokenIfSessionUnchanged('old', 'new', store), 'stored');
  assert.equal(current(), 'new');
});

test('does not bring a signed-out user back when they signed out during the request', async () => {
  const device = makeStore('old');
  const swap = replaceTokenIfSessionUnchanged('old', 'new', {
    ...device.store,
    get: async () => {
      device.signOutNow();
      return device.store.get();
    },
  });
  assert.equal(await swap, 'session_changed');
  assert.equal(device.current(), null, 'no token was written back');
});

test('does not overwrite a different session that signed in meanwhile', async () => {
  const { store, current } = makeStore('someone-else');
  assert.equal(await replaceTokenIfSessionUnchanged('old', 'new', store), 'session_changed');
  assert.equal(current(), 'someone-else');
});

test('treats a device that held no token before the request as changed', async () => {
  const { store, current } = makeStore(null);
  assert.equal(await replaceTokenIfSessionUnchanged(null, 'new', store), 'session_changed');
  assert.equal(current(), null);
});

test('reports a storage failure instead of pretending the device stays signed in', async () => {
  const { store } = makeStore('old', { failSet: true });
  assert.equal(await replaceTokenIfSessionUnchanged('old', 'new', store), 'storage_failed');
});

test('only a failed write means the user has to sign in again on this device', () => {
  assert.equal(mustSignInAgain('storage_failed'), true);
  assert.equal(mustSignInAgain('stored'), false);
  // The user signed out while the request ran: they already know, there is nothing to add.
  assert.equal(mustSignInAgain('session_changed'), false);
  assert.equal(mustSignInAgain(undefined), false);
});
