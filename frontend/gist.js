const Gist = (() => {
  const baseUrl = 'https://api.github.com';

  function headers(token) {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
  }

  async function request(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${response.status}`);
    }
    return response;
  }

  async function load(id, token) {
    const gist = await (await request(`${baseUrl}/gists/${id}`, { headers: headers(token) })).json();
    const content = gist.files['library.json']?.content;
    if (!content) throw new Error('library.json was not found in this Gist.');
    return JSON.parse(content);
  }

  async function save(id, token, data) {
    await request(`${baseUrl}/gists/${id}`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({ files: { 'library.json': { content: JSON.stringify(data, null, 2) } } })
    });
  }

  async function create(token, data) {
    const response = await request(`${baseUrl}/gists`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        description: 'Wan Shi Tong media library',
        public: false,
        files: { 'library.json': { content: JSON.stringify(data, null, 2) } }
      })
    });
    return (await response.json()).id;
  }

  return { load, save, create };
})();

const GistSync = (() => {
  function credentials(settings) {
    return { token: settings.token.trim(), gistId: settings.gistId.trim() };
  }

  async function load(settings) {
    const { token, gistId } = credentials(settings);
    const data = await Gist.load(gistId, token);
    return { items: data.items || data, syncVersion: data.syncVersion || 0 };
  }

  async function sync(settings, items, syncVersion) {
    const { token, gistId } = credentials(settings);
    if (!token) throw new Error('Add a GitHub personal access token first.');

    if (!gistId) {
      const data = { version: 1, syncVersion: 1, items };
      return { gistId: await Gist.create(token, data), items, syncVersion: 1 };
    }

    const remote = await Gist.load(gistId, token);
    const remoteVersion = remote.syncVersion || 0;
    const nextItems = remoteVersion > syncVersion ? (remote.items || remote) : items;
    const nextVersion = Math.max(remoteVersion, syncVersion) + 1;
    await Gist.save(gistId, token, { version: 1, syncVersion: nextVersion, items: nextItems });
    return { gistId, items: nextItems, syncVersion: nextVersion };
  }

  return { load, sync };
})();
