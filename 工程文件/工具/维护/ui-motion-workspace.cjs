'use strict';
// File-level staging only: never replaces another task's build or source tree.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),work=path.join(root,'.cache/ui-motion-20261024');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function target(relative){const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))throw Error('Outside project');return file;}
function stage(relative){const file=target(relative),out=path.join(work,'staged',relative),before=path.join(work,'baseline',relative);fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(path.dirname(before),{recursive:true});if(!fs.existsSync(before)&&fs.existsSync(file))fs.copyFileSync(file,before);if(!fs.existsSync(out)&&fs.existsSync(file))fs.copyFileSync(file,out);return out;}
function apply(relative){const file=target(relative),before=path.join(work,'baseline',relative),out=path.join(work,'staged',relative);const current=fs.existsSync(file)?fs.readFileSync(file):null,original=fs.existsSync(before)?fs.readFileSync(before):null,next=fs.readFileSync(out);if(current&&hash(current)===hash(next))return;if((current===null)!==(original===null)||current&&hash(current)!==hash(original))throw Error('Concurrent change; merge required: '+relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,next);}
module.exports={root,work,stage,apply,hash};
if(require.main===module){const [operation,...files]=process.argv.slice(2);if(!['stage','apply'].includes(operation))throw Error('Expected stage or apply');for(const file of files){const value=operation==='stage'?stage(file):apply(file);console.log(file+(value?' -> '+value:''));}}
