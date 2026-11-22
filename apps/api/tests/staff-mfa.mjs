// Integration test for a running test instance with the same PG* / STAFF_MFA_KEY.
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {URI} from 'otpauth';
const base=process.env.TEST_URL||'http://localhost:8080/api/v1',username='test-'+Date.now();
const cli=(...args)=>execFileSync('node',['dist/staff-cli.js',...args],{encoding:'utf8'}).trim();
const [password,uri]=cli('create',username,'viewer').split('\n');
const login=code=>fetch(base+'/staff/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password,code})});
try{
 assert.equal((await login(undefined)).status,400);
 const code=URI.parse(uri).generate(), results=await Promise.all([login(code),login(code)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[201,401]);
 const {token}=await results.find(r=>r.ok).json();const queue=()=>fetch(base+'/reception',{headers:{Authorization:`Bearer ${token}`}});
 assert.equal((await queue()).status,200);const newUri=cli('reset-mfa',username);
 assert.equal((await queue()).status,401);assert.equal((await login(URI.parse(newUri).generate())).status,201);
 console.log('Required MFA, one-time use, recovery and session revocation passed.');
}finally{cli('disable',username)}
