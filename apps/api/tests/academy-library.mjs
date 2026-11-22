// Disposable local instance; exercise the real cookie and origin guard.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Client} from 'pg';
const db=new Client();await db.connect();const base='http://localhost:8080/api/v1/client',users=[],headers={'X-Rahmani-Client':'1','Content-Type':'application/json'};
async function account(){const username='lib-'+randomUUID();users.push(username);const r=await fetch(base+'/register',{method:'POST',headers,body:JSON.stringify({username,password:randomUUID()})});assert.equal(r.status,201);return r.headers.get('set-cookie').split(';')[0]}
const call=(cookie,path='',method='GET')=>fetch(base+'/library'+path,{method,headers:{...headers,cookie}});
try{assert.equal((await call('')).status,401);const a=await account(),b=await account();assert.equal((await fetch(base+'/library/dialogue',{method:'POST',headers:{cookie:a}})).status,403);await Promise.all([1,2].map(async()=>assert.equal((await call(a,'/dialogue','POST')).status,201)));assert.deepEqual(await (await call(a)).json(),['dialogue']);assert.deepEqual(await (await call(b)).json(),[]);assert.equal((await call(a,'/unknown','POST')).status,404);assert.deepEqual((await (await fetch(base,{headers:{cookie:a}})).json()).library,['dialogue']);assert.equal((await call(a,'/dialogue','DELETE')).status,200);assert.deepEqual(await (await call(a)).json(),[]);console.log('Private library API checks passed.');}finally{await db.query('DELETE FROM client_accounts WHERE username=ANY($1)',[users]);await db.end()}
