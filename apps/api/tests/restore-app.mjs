// Internal fixture for ops/tests/postgres-restore.sh. No external services or real data.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {NestFactory} from '@nestjs/core';
import {DataSource} from 'typeorm';
import {URI} from 'otpauth';
import {ContactModule} from '../dist/contact.js';
const seed=process.argv[2]==='seed',dir=process.env.DRILL_DIR;
assert.match(dir,/^\/tmp\/rahmani-drill\.[A-Za-z0-9]+$/);assert.equal(process.env.PGHOST,`${dir}/${seed?'source':'target'}-socket`);
const app=await NestFactory.create(ContactModule,{logger:["error"],abortOnError:false});
try{const db=app.get(DataSource);const username='restore-reviewer';const path=dir+'/fixture';
 if(seed){const [password,uri]=execFileSync(process.execPath,['dist/staff-cli.js','create',username,'viewer'],{encoding:'utf8'}).trim().split('\n');
 const client=randomUUID(),slot=randomUUID(),quote=randomUUID(),reviewer=randomUUID();const [{id}]=await db.query('SELECT id FROM staff_accounts WHERE username=$1',[username]);
 await db.query("INSERT INTO staff_accounts(id,username,role,salt,verifier,active) VALUES($1,'fixture-reviewer','reception','','',false)",[reviewer]);
 await db.query("INSERT INTO client_accounts(id,username,salt,verifier) VALUES($1,'fixture-client','','')",[client]);
 await db.query("INSERT INTO appointment_slots(id,service,mode,starts_at,ends_at,published_by,fee_irr) VALUES($1,0,'online',now()+interval '1 day',now()+interval '1 day 30 minutes',$2,850000)",[slot,reviewer]);
 await db.query('INSERT INTO booking_quotes(id,client_id,slot_id,hold_key,amount_irr,expires_at) VALUES($1,$2,$3,$4,850000,now())',[quote,client,slot,quote]);
 await db.query("INSERT INTO gateway_payments(quote_id,authority,state,reference,verified_at) VALUES($1,$2,'confirmed','RESTORE-TEST',now())",[quote,quote]);
 await db.query("INSERT INTO cancellation_requests(quote_id,requested_slot,reviewer,seen_at,decision,decided_by,decided_at) VALUES($1,$2,$3,now(),'approved',$3,now())",[quote,slot,reviewer]);
 await db.query("INSERT INTO cancellation_reviews(quote_id,staff_id,proposed_irr,finished_at,refund_decision,authorized_by,authorized_at) VALUES($1,$2,400000,now(),'approved',$3,now())",[quote,reviewer,id]);
 writeFileSync(path,JSON.stringify({password,uri,quote}),{mode:0o600});
 }else{const {password,uri,quote}=JSON.parse(readFileSync(path));await app.listen(0,'127.0.0.1');const base=await app.getUrl(),report=base+'/api/v1/reception/sessions/finance/report?category=missing';assert.equal((await fetch(report)).status,401);
 const login=await fetch(base+'/api/v1/staff/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password,code:URI.parse(uri).generate()})});assert.equal(login.status,201);const {token,role}=await login.json();assert.equal(role,'viewer');const r=await fetch(report,{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);const data=await r.json();assert.deepEqual(data.totals,[{category:'missing',count:1,approved:'400000',recorded:'0'}]);assert.equal(data.items[0].quote_id,quote);console.log('Restored MFA login and protected refund totals verified.');}
}finally{await app.get(DataSource).destroy();await app.close()}
