'use strict';
const assert=require('node:assert/strict');
// The installed updater is permanent. Keep its wire/save contract readable by
// the first supported release instead of raising the floor at each publication.
const CONTRACT=Object.freeze({format:3,protocol:1,engine:'1.4.0',minBaseVersion:'2.0.41',saveSchema:1,saveContract:'cyber2051.raw-save.v1'});
function checkSeeds(seed,oldSeed){
  for(const value of [seed,oldSeed]){
    assert.equal(value.engineVersion,CONTRACT.engine,'Stable updater engine contract changed; provide an explicit compatibility path first');
    assert.equal(value.release?.protocol,CONTRACT.protocol,'Complete-release protocol changed');
    assert.equal(value.migration?.saveSchema,CONTRACT.saveSchema,'Old saves need an implemented migration, not a raised minimum version');
    assert.equal(value.migration?.contract,CONTRACT.saveContract,'Preserve the raw-save migration contract');
  }
  assert.deepEqual(seed.trustedKeys,oldSeed.trustedKeys,'Old updaters must still trust the package signing key');
}
function checkPack(pack){
  assert.equal(pack.format,CONTRACT.format);
  assert.equal(pack.release.protocol,CONTRACT.protocol);
  assert.equal(pack.release.minBaseVersion,CONTRACT.minBaseVersion,'Do not drop old versions from cumulative releases');
  assert.equal(pack.release.saveSchema,CONTRACT.saveSchema);
  assert.equal(pack.release.seed.migration.contract,CONTRACT.saveContract);
  assert.equal(pack.requires.engine,CONTRACT.engine);
  assert.deepEqual(pack.requires.packages,[],'A full release must not require intermediate update packages');
  for(const key of ['worldbook','regex','scripts'])assert.ok(pack.components[key],'Full target component set missing: '+key);
}
module.exports={CONTRACT,checkSeeds,checkPack};
