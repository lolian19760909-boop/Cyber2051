'use strict';
const Contract = require('./workshop-contract.cjs');
function createWorkshopBridge({ db, send, readBody, ownerSession, officialRelease, modulePath }) {
  db.exec(`CREATE TABLE IF NOT EXISTS workshop_contract_packages (
    submission_id INTEGER NOT NULL, revision INTEGER NOT NULL, source_hash TEXT NOT NULL,
    package_hash TEXT NOT NULL, artifact TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(submission_id,revision))`);
  const library = () => Contract.library(modulePath);
  function getArtifact(id, revision) {
    const row = db.prepare('SELECT artifact FROM workshop_contract_packages WHERE submission_id=? AND revision=?').get(id, revision);
    if (!row) return null;
    const artifact = JSON.parse(row.artifact), P = library();
    if (P.sha256(P.canonical(artifact.package)) !== artifact.packageSha256 || P.canonical(artifact.source) !== P.canonical(artifact.package.content.worldbook[0].extra.__cxx_workshop_source)) throw new Contract.ContractError('已审包记录损坏', 'artifact_corrupt', 409);
    return artifact;
  }
  function ensureArtifact(row) {
    const old = getArtifact(row.id, row.revision);
    if (old) {
      if (old.source.payloadSha256 !== row.content_hash || old.source.publisherId !== row.publisher_id || old.source.submissionSha256 !== Contract.snapshotHash(row, library())) throw new Contract.ContractError('已审包来源发生变化', 'source_hash_mismatch', 409);
      return old;
    }
    const identity = db.prepare('SELECT publisher_id,status,display_name_last FROM publishers WHERE publisher_id=?').get(row.publisher_id);
    const first = db.prepare('SELECT artifact FROM workshop_contract_packages WHERE submission_id=? ORDER BY revision LIMIT 1').get(row.id);
    const P = library(), artifact = Contract.compile(row, identity, P, first ? { packageId:JSON.parse(first.artifact).package.id } : {});
    db.prepare('INSERT INTO workshop_contract_packages VALUES (?,?,?,?,?,?)').run(row.id, row.revision, row.content_hash, artifact.packageSha256, P.canonical(artifact), new Date().toISOString());
    return artifact;
  }
  function approved(id, revision) {
    const row = db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
    if (!row || !Contract.CONTENT_TYPES.includes(row.type) || row.status !== 'approved') throw new Contract.ContractError('此投稿尚未通过审核、已撤下或需要新版卡集成', 'contract_not_approved', 404);
    if (revision !== undefined && revision !== row.revision) throw new Contract.ContractError('投稿已变化，请重新审核或预览', 'revision_conflict', 409);
    return row;
  }
  function assertSources(packages) {
    const P = library();
    for (const pkg of packages) {
      const sources = (pkg.content?.worldbook || []).map(e => e.extra?.__cxx_workshop_source).filter(Boolean);
      if (pkg.id?.startsWith('community.') && (pkg.kind !== 'content' || sources.length !== 1)) throw new Contract.ContractError('社区投稿包必须携带唯一已审来源', 'source_required', 409);
      for (const source of sources) {
        const row = approved(source.submissionId, source.revision), artifact = getArtifact(row.id, row.revision);
        const identity = db.prepare('SELECT status FROM publishers WHERE publisher_id=?').get(row.publisher_id);
        const unsigned = { ...pkg }; delete unsigned.signature;
        if (!artifact || identity?.status !== 'active' || source.publisherId !== row.publisher_id || source.payloadSha256 !== row.content_hash || P.sha256(row.payload) !== row.content_hash || source.submissionSha256 !== Contract.snapshotHash(row, P) || P.canonical(artifact.source) !== P.canonical(source) || P.sha256(P.canonical(unsigned)) !== artifact.packageSha256) throw new Contract.ContractError('已审来源、归属或包内容已变化，请重新预览', 'source_hash_mismatch', 409);
      }
    }
  }
  function revision(value) { if (!Number.isSafeInteger(value) || value < 1) throw new Contract.ContractError('请提供明确的 baseRevision'); return value; }
  function packageRef(row) {
    const artifact = row.status === 'approved' ? getArtifact(row.id, row.revision) : null;
    return artifact ? { id: artifact.package.id, version: artifact.package.version, optional: true, activation: artifact.package.activation,
      questId: artifact.package.content.quests[0]?.id || null, packageSha256: artifact.packageSha256,
      exportUrl: '/api/workshop/submissions/' + row.id + '/contract-package' } : null;
  }
  function handle(req, res, p, method) {
    if(p==='/api/workshop/content/preview' && method==='POST'){
      readBody(req,res,raw=>{try{
        const data=JSON.parse(raw);Contract.validateMetadata({title:data.title,summary:data.summary||'',tags:data.tags||[]});
        const payload=Contract.validateIncoming(data.type,data.payload,{title:data.title,summary:data.summary||'',authorName:data.authorName,tags:data.tags||[]});
        const preview={delivery:data.type==='code_component'?'next_card':'signed_content',template:payload.templateKind||data.type,mapId:payload.contract?.mapId||payload.mapId,placeId:payload.contract?.placeId||payload.placeId,
          definitions:payload.gameplay?Object.fromEntries(Object.entries(payload.gameplay).filter(([k,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length])):{},installsAssets:false};
        send(res,200,{ok:true,preview:{...preview,...Contract.presentation(data)}});
      }catch(e){send(res,e.status||400,{ok:false,error:e.code||'invalid_content',message:e.message});}});return true;
    }
    const edit = p.match(/^\/api\/workshop\/submissions\/(\d+)\/edit$/);
    const publicPackage = p.match(/^\/api\/workshop\/submissions\/(\d+)\/(?:contract-package|content-package)$/);
    const adminPackage = p.match(/^\/api\/admin\/submissions\/(\d+)\/(?:contract-package|content-package)$/);
    const preview = p.match(/^\/api\/official\/workshop\/(\d+)\/preview$/);
    if (!edit && !publicPackage && !adminPackage && !preview && p !== '/api/workshop/contracts/schema') return false;
    function respond(work) {
      try { const result = work(); send(res, 200, { ok: true, ...result }); }
      catch (e) { send(res, e.status || 500, { ok: false, error: e.code || 'contract_error', ...(e instanceof Contract.ContractError ? { message: e.message } : {}) }); }
    }
    if (p === '/api/workshop/contracts/schema' && method === 'GET') respond(() => ({ schema: Contract.schema() }));
    else if (edit && method === 'GET') respond(() => {
      const row = db.prepare('SELECT * FROM submissions WHERE id=?').get(Number(edit[1]));
      if (!row || !ownerSession(req, row)) throw new Contract.ContractError('只有作者可以读取改稿', 'unauthorized_for_submission', 403);
      return { item: { id: row.id, type: row.type, title: row.title, summary: row.summary, authorName: row.author_name, tags: JSON.parse(row.tags), payload: JSON.parse(row.payload), revision: row.revision, status: row.status } };
    });
    else if (publicPackage && method === 'GET') respond(() => {
      const row = approved(Number(publicPackage[1])), artifact = getArtifact(row.id, row.revision);
      if (!artifact) throw new Contract.ContractError('请管理员为此修订生成兼容包', 'package_not_ready', 409);
      return { artifact };
    });
    else if (adminPackage && method === 'POST') readBody(req, res, raw => respond(() => {
      const data = JSON.parse(raw); if (Object.keys(data).some(key => key !== 'baseRevision')) throw new Contract.ContractError('只接受 baseRevision');
      const row = approved(Number(adminPackage[1]), revision(data.baseRevision));
      return { artifact: ensureArtifact(row) };
    }));
    else if (preview && method === 'POST') {
      try { officialRelease.actor(req); } catch (e) { send(res, e.status || 403, { ok: false, error: e.code || 'official_release_forbidden' }); return true; }
      readBody(req, res, raw => respond(() => {
        const data = JSON.parse(raw);
        if (Object.keys(data).some(key => !['baseRevision','packageSha256'].includes(key))) throw new Contract.ContractError('预览只接受已审版本和包指纹');
        const row = approved(Number(preview[1]), revision(data.baseRevision)), artifact = getArtifact(row.id, row.revision);
        if (!artifact || artifact.packageSha256 !== data.packageSha256) throw new Contract.ContractError('已审包已变化，请重新获取', 'source_hash_mismatch', 409);
        if (artifact.source.submissionSha256 !== Contract.snapshotHash(row, library())) throw new Contract.ContractError('已审来源发生变化', 'source_hash_mismatch', 409);
        assertSources([artifact.package]);
        return officialRelease.preview(req, { contents: [artifact.package] });
      }));
    } else send(res, 404, { ok: false, error: 'not_found' });
    return true;
  }
  return { handle, ensureArtifact, getArtifact, packageRef, assertSources };
}
module.exports = { createWorkshopBridge };
