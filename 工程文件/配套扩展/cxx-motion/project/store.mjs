export function createProjectStore(index = indexedDB) {
  let connection;
  let closed = false;
  async function database() {
    if (closed) throw new Error('项目库已关闭。');
    if (!connection) connection = new Promise((resolve, reject) => {
      const request = index.open('tavern-visual-projects', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('projects');
      request.onsuccess = () => {
        const db = request.result;
        if (closed) { db.close(); reject(new Error('项目库已关闭。')); return; }
        db.onversionchange = () => { db.close(); connection = null; };
        resolve(db);
      };
      request.onerror = () => { connection = null; reject(request.error); };
    });
    return connection;
  }
  async function transaction(mode, run) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', mode);
      let result, failure;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error);
      try { run(tx.objectStore('projects'), value => { result = value; }, error => { failure = error; tx.abort(); }); }
      catch (error) { failure = error; tx.abort(); }
    });
  }
  const key = project => `${project.manifest.id}@${project.manifest.version}`;
  return Object.freeze({
    put(project) {
      return transaction('readwrite', (store, done, fail) => {
        const request = store.get(key(project));
        request.onsuccess = () => {
          if (request.result && request.result.fingerprint !== project.fingerprint) { fail(new Error('同一项目版本已有不同内容，请提高项目版本后导入。')); return; }
          store.put(project, key(project));
          done(key(project));
        };
      });
    },
    get(id) { return transaction('readonly', (store, done) => { store.get(id).onsuccess = event => done(event.target.result); }); },
    list() {
      return transaction('readonly', (store, done) => {
        const entries = [];
        store.openCursor().onsuccess = event => {
          const cursor = event.target.result;
          if (!cursor) { done(entries); return; }
          const { manifest, fingerprint } = cursor.value;
          entries.push({ key: cursor.key, manifest, fingerprint });
          cursor.continue();
        };
      });
    },
    remove(id) { return transaction('readwrite', store => store.delete(id)); },
    async close() { closed = true; (await connection)?.close(); connection = null; },
  });
}
