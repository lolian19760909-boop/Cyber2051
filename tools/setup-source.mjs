import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const suite=path.join(root,'工程文件/配套扩展/tavern-runtime-suite');
const patch=path.join(root,'工程文件/配套扩展/patches/runtime-suite-motion.patch');
const git=args=>spawnSync('git',['-C',suite,...args],{encoding:'utf8'});
if(!fs.existsSync(path.join(suite,'package.json')))throw Error('请先运行 git submodule update --init --recursive');
if(git(['apply','--reverse','--check',patch]).status===0){console.log('Runtime Suite 已包含当前 motion 修改');process.exit(0);}
if(git(['apply','--check',patch]).status!==0)throw Error('Runtime Suite 与本版补丁不匹配，请检查已有改动');
const applied=git(['apply',patch]);if(applied.status!==0)throw Error(applied.stderr);
console.log('Runtime Suite motion 修改已应用');
