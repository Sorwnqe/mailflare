import { getPlatformProxy } from 'wrangler';
import { randomUUID, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { exportDatabaseRecords } from '../src/lib/backups/export';

// The build must already have succeeded. Save a verified backup before any
// schema change; credentials are supplied by Cloudflare Builds, never committed.
const proxy = await getPlatformProxy({
 configPath: new URL('../deploy/cloudflare-backup.jsonc', import.meta.url).pathname,
 persist: false,
});
try {
 const { DB, BUCKET } = proxy.env as { DB: D1Database; BUCKET: R2Bucket };
 const content = await exportDatabaseRecords(DB);
 const id = `bak_${randomUUID().replaceAll('-', '')}`;
 const filename = `mailflare-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
 const key = `backups/database/${id}/${filename}`;
 await BUCKET.put(key, content, {httpMetadata:{contentType:'application/json'},customMetadata:{backupId:id}});
 const object = await BUCKET.get(key);
 if (!object) throw new Error('Pre-deployment backup was not stored');
 const stored = new Uint8Array(await object.arrayBuffer());
 const digest = (bytes:Uint8Array) => createHash('sha256').update(bytes).digest('hex');
 if (digest(stored) !== digest(content)) throw new Error('Pre-deployment backup verification failed');
 await DB.prepare("INSERT INTO backups (id,status,trigger,r2_key,filename,size,created_at,started_at,completed_at) VALUES (?,'completed','manual',?,?,?,unixepoch(),unixepoch(),unixepoch())")
  .bind(id,key,filename,content.byteLength).run();
 console.log(`Verified pre-deployment backup: ${content.byteLength} bytes`);
} finally {
 await proxy.dispose();
}

for (const command of ['db:migrate:remote','deploy:worker']) {
 const result = spawnSync('npm',['run',command],{stdio:'inherit'});
 if (result.error) throw result.error;
 if (result.status !== 0) process.exit(result.status ?? 1);
}
for (const path of ['/login','/api/setup/status']) {
 const response = await fetch(`https://mailflare.y2k.ventures${path}`,{signal:AbortSignal.timeout(30000)});
 if (response.status !== 200) throw new Error(`Deployment health check failed: ${path} (${response.status})`);
}
console.log('Production deployment and public health checks completed');
