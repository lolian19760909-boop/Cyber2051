'use strict';
const W=require('./public/submission-template.js');
function createHistory(db) {
  // 首次部署只建表和触发器，不更新任何历史稿。快照不含会话或编辑凭据。
  db.exec(`CREATE TABLE IF NOT EXISTS submission_revisions (
    submission_id INTEGER NOT NULL, revision INTEGER NOT NULL, saved_at TEXT NOT NULL,
    snapshot TEXT NOT NULL, PRIMARY KEY (submission_id,revision)
  );
  CREATE TRIGGER IF NOT EXISTS snapshot_submission_before_revision
  BEFORE UPDATE OF revision ON submissions WHEN NEW.revision <> OLD.revision
  BEGIN
    INSERT OR IGNORE INTO submission_revisions VALUES (OLD.id, OLD.revision, datetime('now'),
      json_object('id',OLD.id,'revision',OLD.revision,'type',OLD.type,'title',OLD.title,
        'summary',OLD.summary,'authorName',OLD.author_name,'tags',json(OLD.tags),'payload',json(OLD.payload)));
  END;
  CREATE TRIGGER IF NOT EXISTS cleanup_deleted_submission_revisions
  AFTER DELETE ON submissions BEGIN DELETE FROM submission_revisions WHERE submission_id=OLD.id; END;`);
  return {
    previous(id,revision) {
      const row=db.prepare('SELECT snapshot FROM submission_revisions WHERE submission_id=? AND revision<? ORDER BY revision DESC LIMIT 1').get(id,revision);
      return row?JSON.parse(row.snapshot):null;
    },
    compare(current) {
      const previous=this.previous(current.id,current.revision);
      if(!previous)return {previousRevision:null,changes:[],note:current.revision>1?'此前版本没有正文快照；从本次改稿起保留对照。':'首次投稿。'};
      const a=flatten(previous),b=flatten(current),changes=[];
      for(const key of new Set([...Object.keys(a),...Object.keys(b)]))if(a[key]!==b[key])changes.push({label:key,before:a[key]??'',after:b[key]??''});
      return {previousRevision:previous.revision,changes,note:changes.length?'':'正文与基本资料未变化，本修订可能仅调整附件。'};
    },
  };
}
function flatten(row) {
  const p=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;
  const tags=typeof row.tags==='string'?JSON.parse(row.tags):row.tags;
  const out={'标题':row.title||'','一句话简介':row.summary||'','署名':row.authorName||row.author_name||'','标签':(tags||[]).join('、'),'类别':row.type};
  function walk(value,prefix) {
    for(const [key,v]of Object.entries(value||{})){
      const label=prefix?prefix+' / '+key:key;
      if(v && typeof v==='object'&&!Array.isArray(v))walk(v,label);
      else out[label]=typeof v==='string'?v:JSON.stringify(v);
    }
  }
  if(p.templateVersion===W.version) {
    const form=W.byKind(p.templateKind);
    for(const f of form.fields)out[f.label[0]]=p.sections[f.name]||'';
    walk(Object.fromEntries(Object.entries(p).filter(([k])=>k!=='sections')),'参数');
  }else walk(p,'原稿');
  return out;
}
module.exports={createHistory};
