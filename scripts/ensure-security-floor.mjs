import {readFileSync,writeFileSync} from 'node:fs';
const file=new URL('../package.json',import.meta.url);
const pkg=JSON.parse(readFileSync(file,'utf8'));
const floor=[16,4,2];
for(const [group,name] of [['dependencies','next'],['devDependencies','@next/eslint-plugin-next']]){
 const version=pkg[group]?.[name];
 const match=version?.match(/^(?:[~^])?(\d+)\.(\d+)\.(\d+)$/);
 if(!match)throw new Error(`Review security version policy for ${name}: ${version}`);
 const parts=match.slice(1).map(Number);
 const delta=parts.map((v,i)=>v-floor[i]).find(v=>v!==0)??0;
 if(delta<0)pkg[group][name]=floor.join('.');
}
writeFileSync(file,JSON.stringify(pkg,null,2)+'\n');
