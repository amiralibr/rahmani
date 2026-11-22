import {enroll} from './mfa';
/** Host-only provisioning; generated password is printed once to the operator. */
import 'reflect-metadata';
import {randomBytes,randomUUID} from 'node:crypto';
import {DataSource} from 'typeorm';
import {derive} from './staff';
async function main(){const [cmd,user,role]=process.argv.slice(2);if(!['grant-refund','revoke-refund','create','disable','reset-mfa','reset-password'].includes(cmd)||!user||!/^[a-z0-9._-]{3,64}$/.test(user)||(cmd==='create'&&!['viewer','reception','specialist','manager'].includes(role)))throw Error('Use: create USER reception|viewer|specialist|manager, or disable USER');
 const db=await new DataSource({type:'postgres',host:process.env.PGHOST||'localhost',port:Number(process.env.PGPORT||5432),username:process.env.PGUSER||'rahmani',password:process.env.PGPASSWORD,database:process.env.PGDATABASE||'rahmani'}).initialize();
 try{if(cmd==='grant-refund'||cmd==='revoke-refund'){const rows=await db.query("WITH u AS (UPDATE staff_accounts SET refund_approver=$2 WHERE username=$1 AND role='reception' RETURNING id) SELECT id FROM u",[user,cmd==='grant-refund']);if(!rows.length)throw Error('Unknown reception account');return}
 if(cmd==='disable'){const r=await db.query('WITH u AS (UPDATE staff_accounts SET active=false WHERE username=$1 RETURNING id) SELECT id FROM u',[user]);if(!r.length)throw Error('Unknown account');return}
 if(cmd==='reset-mfa'||cmd==='reset-password'){
 const password=randomBytes(24).toString('base64url'),salt=randomBytes(16).toString('hex'),factor=cmd==='reset-mfa'?enroll(user):null;
 await db.transaction(async m=>{const ids=factor?await m.query('WITH u AS (UPDATE staff_accounts SET mfa_secret=$1,mfa_counter=-1 WHERE username=$2 AND active RETURNING id) SELECT id FROM u',[factor.sealed,user]):await m.query('WITH u AS (UPDATE staff_accounts SET salt=$1,verifier=$2 WHERE username=$3 AND active RETURNING id) SELECT id FROM u',[salt,await derive(password,salt,64),user]);if(!ids.length)throw Error('Unknown account');await m.query('DELETE FROM staff_sessions WHERE staff_id=$1',[ids[0].id])});console.log(factor?factor.uri:password);return;
 }
 const password=randomBytes(24).toString('base64url'),salt=randomBytes(16).toString('hex'),factor=enroll(user);await db.query('INSERT INTO staff_accounts(id,username,salt,verifier,role,mfa_secret) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),user,salt,await derive(password,salt,64),role,factor.sealed]);console.log(password+'\n'+factor.uri);
 }finally{await db.destroy()}}
main().catch(()=>{console.error('Staff command failed. Check arguments, database and existing accounts.');process.exitCode=1});
