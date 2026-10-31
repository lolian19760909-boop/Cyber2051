export function createResources(project, urls = URL) {
  const objects = new Map();
  let disposed = false;
  function blob(path) {
    if (disposed) throw new Error('项目资源已释放。');
    const value = project.blobs.get(path);
    if (!value) throw new Error(`项目未提供资源：${path}`);
    return value;
  }
  return Object.freeze({
    blob,
    async bytes(path) { return new Uint8Array(await blob(path).arrayBuffer()); },
    url(path) {
      const value = blob(path);
      if (!objects.has(path)) objects.set(path, urls.createObjectURL(value));
      return objects.get(path);
    },
    diagnostics: () => ({ objectURLs: objects.size, disposed }),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const url of objects.values()) urls.revokeObjectURL(url);
      objects.clear();
    },
  });
}
