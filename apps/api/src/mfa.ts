import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {Secret,TOTP} from 'otpauth';
import {MigrationInterface,QueryRunner} from 'typeorm';

export class StaffMfa1795046400004 implements MigrationInterface {
 async up(q:QueryRunner){
   await q.query('ALTER TABLE staff_accounts ADD COLUMN mfa_secret bytea, ADD COLUMN mfa_counter bigint NOT NULL DEFAULT -1');
   await q.query('DELETE FROM staff_sessions'); // Pre-MFA sessions cannot be upgraded.
 }
 async down(q:QueryRunner){await q.query('DELETE FROM staff_sessions');await q.query('ALTER TABLE staff_accounts DROP COLUMN mfa_secret,DROP COLUMN mfa_counter')}
}
function key(){const hex=process.env.STAFF_MFA_KEY;if(!hex||!/^[a-f0-9]{64}$/i.test(hex))throw Error('Configure STAFF_MFA_KEY before provisioning staff');return Buffer.from(hex,'hex')}
function otp(username:string,secret:Secret){return new TOTP({issuer:'Rahmani Centre',label:username,secret,period:30,digits:6,algorithm:'SHA1'})}
export function enroll(username:string){
 const secret=new Secret({size:20}),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(Buffer.from(username));
 const encrypted=Buffer.concat([cipher.update(secret.base32,'ascii'),cipher.final()]);
 return {uri:otp(username,secret).toString(),sealed:Buffer.concat([iv,cipher.getAuthTag(),encrypted])};
}
export function verify(username:string,sealed:Buffer,token:string){
 const cipher=createDecipheriv('aes-256-gcm',key(),sealed.subarray(0,12));cipher.setAAD(Buffer.from(username));cipher.setAuthTag(sealed.subarray(12,28));
 const base32=Buffer.concat([cipher.update(sealed.subarray(28)),cipher.final()]).toString('ascii');
 const totp=otp(username,Secret.fromBase32(base32)),timestamp=Date.now(),delta=totp.validate({token,timestamp,window:1});
 return delta===null?null:totp.counter({timestamp})+delta;
}
