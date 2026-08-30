const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function library({ token = '', items = [{ title: 'Dune', kind: 'book' }] } = {}) {
  const context = {
    localStorage: { setItem() {}, getItem() { return null; } },
    window: { confirm: () => true },
    document: { addEventListener() {}, body: { style: {} } },
    lucide: { createIcons() {} },
    GistSync: {},
    console
  };
  vm.runInNewContext(`${fs.readFileSync('app.js', 'utf8')}; globalThis.library = mediaLibrary;`, context);
  return { app: { ...context.library(), items, settings: { token, gistId: '', tmdbToken: '' } }, context };
}

test('adding an item syncs when a Gist token is configured', async () => {
  const { app } = library({ token: 'token', items: [] });
  let synced = 0;
  app.newItem = { ...app.newItem, title: 'Dune' };
  app.syncGist = async () => { synced += 1; };

  await app.saveItem();

  assert.equal(app.items.length, 1);
  assert.equal(synced, 1);
});

test('deleting an item syncs when a Gist token is configured', async () => {
  const { app } = library({ token: 'token' });
  let synced = 0;
  app.selectedItem = app.items[0];
  app.syncGist = async () => { synced += 1; };

  await app.deleteItem();

  assert.equal(app.items.length, 0);
  assert.equal(synced, 1);
});
