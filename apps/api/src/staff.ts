import {verify} from './mfa';
import {Body,Controller,Header,Headers,Inject,Post,UnauthorizedException} from '@nestjs/common';
import {IsString,Length,Matches} from 'class-validator';
import {createHash,randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
export const derive=promisify(scrypt);
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export class Staff1795046400003 implements MigrationInterface {
 async up(q:QueryRunner){await q.query(`CREATE TABLE staff_accounts(id uuid PRIMARY KEY, username text UNIQUE NOT NULL, salt text NOT NULL, verifier bytea NOT NULL, role text NOT NULL CHECK(role IN ('reception','viewer')), active boolean NOT NULL DEFAULT true)`);
 await q.query(`CREATE TABLE staff_sessions(token_hash text PRIMARY KEY,staff_id uuid NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL)`);
 await q.query(`ALTER TABLE contact_status_events ADD COLUMN actor_id uuid REFERENCES staff_accounts(id) DEFAULT nullif(current_setting('rahmani.actor',true),'')::uuid`);}
 async down(q:QueryRunner){await q.query('ALTER TABLE contact_status_events DROP COLUMN actor_id');await q.query('DROP TABLE staff_sessions,staff_accounts');}
}
class Login { @Matches(/^[a-z0-9._-]{3,64}$/) username!:string; @IsString() @Length(1,128) password!:string; @Matches(/^[0-9]{6}$/) code!:string; }
@Controller('api/v1/staff') export class StaffController {
 constructor(@Inject(DataSource) private db:DataSource){}
 @Post('login') @Header('Cache-Control','no-store') async login(@Body() input:Login){
 const [a]=await this.db.query('SELECT id,active,mfa_secret,salt,verifier,role FROM staff_accounts WHERE username=$1',[input.username]);
 const calculated=await derive(input.password,a?.salt??'00000000000000000000000000000000',64) as Buffer;
 if(!timingSafeEqual(calculated,a?.verifier??Buffer.alloc(64))||!a?.active||!a.mfa_secret)throw new UnauthorizedException();
 const counter=verify(input.username,a.mfa_secret,input.code);if(counter===null)throw new UnauthorizedException();
 const token=randomBytes(32).toString('hex');await this.db.transaction(async m=>{const claimed=await m.query('WITH claimed AS (UPDATE staff_accounts SET mfa_counter=$1 WHERE id=$2 AND active AND mfa_secret=$3 AND mfa_counter<$1 AND verifier=$4 RETURNING id) SELECT id FROM claimed',[counter,a.id,a.mfa_secret,a.verifier]);if(!claimed.length)throw new UnauthorizedException();await m.query('DELETE FROM staff_sessions WHERE expires_at<=now()');await m.query("INSERT INTO staff_sessions VALUES($1,$2,now()+interval '30 minutes')",[digest(token),a.id])});return {token,role:a.role};}
 @Post('logout') async logout(@Headers('authorization') header?:string){if(header?.startsWith('Bearer '))await this.db.query('DELETE FROM staff_sessions WHERE token_hash=$1',[digest(header.slice(7))]);return {ok:true};}
}
export class StaffRoles1795046400028 implements MigrationInterface {
 async up(q:QueryRunner){await q.query("ALTER TABLE staff_accounts DROP CONSTRAINT IF EXISTS staff_accounts_role_check");await q.query("ALTER TABLE staff_accounts ADD CONSTRAINT staff_accounts_role_check CHECK(role IN ('reception','viewer','specialist','manager'))");}
 async down(q:QueryRunner){await q.query("UPDATE staff_accounts SET active=false WHERE role IN ('specialist','manager')");await q.query("ALTER TABLE staff_accounts DROP CONSTRAINT IF EXISTS staff_accounts_role_check");await q.query("ALTER TABLE staff_accounts ADD CONSTRAINT staff_accounts_role_check CHECK(role IN ('reception','viewer'))");}
}
