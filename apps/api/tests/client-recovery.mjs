// Test instance/database only. No secrets written to disk or logs.
import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';import pg from 'pg';
const db=new pg.Client();await db.connect();const base=(process.env.TEST_URL||'http://localhost:8080/api/v1')+'/client',username='qa-'+randomUUID(),password=randomUUID(),next=randomUUID();
const post=(path,body,cookie='')=>fetch(base+path,{method:'POST',headers:{cookie,'Content-Type':'application/json','X-Rahmani-Client':'1'},body:JSON.stringify(body)});
try{const reg=await post('/register',{username,password});assert.equal(reg.status,201);const cookie=reg.headers.get('set-cookie').split(';')[0];assert.equal((await post('/recovery/code',{password:next},cookie)).status,403);
 const issue=async()=>{const r=await post('/recovery/code',{password},cookie);assert.equal(r.status,201);return (await r.json()).code};const old=await issue(),code=await issue();const reset=c=>post('/recovery/reset',{username,code:c,password:next});assert.equal((await reset(old)).status,401);
 assert.deepEqual((await Promise.all([reset(code),reset(code)])).map(r=>r.status).sort(),[201,401]);assert.equal((await fetch(base,{headers:{cookie}})).status,401);assert.equal((await post('/login',{username,password})).status,401);assert.equal((await post('/login',{username,password:next})).status,201);console.log('Recovery rotation, single use, session revocation and new password OK');
}finally{await db.query('DELETE FROM client_accounts WHERE username=$1',[username]);await db.end()}
