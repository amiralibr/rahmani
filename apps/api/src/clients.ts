import {meetingRoom} from './meeting';
import {exam,ExamAnswers} from './exams';
import {tuitionCheckout} from './tuition';
import {enrol,myCourses} from './cohorts';
import {savedCourses,updateLibrary} from './academy-library';
import {cancellationResults,requestCancellation} from './cancellation';
import {recentMoves} from './client-notices';
import {checkout,paymentEnabled,reconcile} from './payments';
import {branchInfo} from './branches';
import {issueQuote,recentQuotes} from './quotes';
import {Body,CanActivate,ConflictException,Controller,Delete,ExecutionContext,ForbiddenException,Get,Header,Headers,Inject,Injectable,NotFoundException,Param,ParseUUIDPipe,Post,Res,UnauthorizedException,UseGuards} from '@nestjs/common';
import {IsString,Length,Matches} from 'class-validator';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import type {Response} from 'express';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
import {derive,digest} from './staff';

export class Clients1795046400007 implements MigrationInterface {
 async up(q:QueryRunner){await q.query('CREATE TABLE client_accounts(id uuid PRIMARY KEY,username text UNIQUE NOT NULL,salt text NOT NULL,verifier bytea NOT NULL)');await q.query('CREATE TABLE client_sessions(token_hash text PRIMARY KEY,client_id uuid NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL)');await q.query('ALTER TABLE appointment_slots ADD COLUMN held_by uuid REFERENCES client_accounts(id)');await q.query('CREATE INDEX client_slots ON appointment_slots(held_by) WHERE held_by IS NOT NULL');}
 async down(q:QueryRunner){await q.query('ALTER TABLE appointment_slots DROP COLUMN held_by');await q.query('DROP TABLE client_sessions,client_accounts');}
}
class Credentials { @Matches(/^[a-z0-9._-]{3,48}$/) username!:string; @IsString() @Length(12,128) password!:string; }
class RecoveryInput extends Credentials { @Matches(/^[a-f0-9]{40}$/) code!:string; }
class PasswordCheck { @IsString() @Length(12,128) password!:string; }
class LinkHold { @Matches(/^[a-f0-9]{64}$/) token!:string; }
const cookieName='rahmani_client',cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/api/v1/client'};
function sessionHash(cookie=''){const raw=cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);return raw&&/^[a-f0-9]{64}$/.test(raw)?digest(raw):''}
@Injectable() export class ClientOriginGuard implements CanActivate {
 canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest();if(req.method!=='GET'&&req.headers['x-rahmani-client']!=='1')throw new ForbiddenException();return true;}
}
@Controller('api/v1/client') @UseGuards(ClientOriginGuard) export class ClientController {
 constructor(@Inject(DataSource) private db:DataSource){}
 private async account(cookie:string){const [a]=await this.db.query('SELECT a.id,a.username FROM client_accounts a JOIN client_sessions s ON s.client_id=a.id WHERE s.token_hash=$1 AND s.expires_at>now()',[sessionHash(cookie)]);if(!a)throw new UnauthorizedException();return a;}
 private async session(id:string,res:Response,verifier:Buffer){const token=randomBytes(32).toString('hex');await this.db.query('DELETE FROM client_sessions WHERE expires_at<=now()');await this.db.transaction(async m=>{const rows=await m.query('SELECT id FROM client_accounts WHERE id=$1 AND verifier=$2 FOR SHARE',[id,verifier]);if(!rows.length)throw new UnauthorizedException();await m.query("INSERT INTO client_sessions VALUES($1,$2,now()+interval '1 hour')",[digest(token),id])});res.cookie(cookieName,token,{...cookieOptions,maxAge:3600000});return {ok:true};}
 @Post('register') async register(@Body() body:Credentials,@Res({passthrough:true}) res:Response){const salt=randomBytes(16).toString('hex'),id=randomUUID(),verifier=await derive(body.password,salt,64) as Buffer;const rows=await this.db.query('INSERT INTO client_accounts(id,username,salt,verifier) VALUES($1,$2,$3,$4) ON CONFLICT(username) DO NOTHING RETURNING id',[id,body.username,salt,verifier]);if(!rows.length)throw new ConflictException();return this.session(id,res,verifier);}
 @Post('login') async login(@Body() body:Credentials,@Res({passthrough:true}) res:Response){const [a]=await this.db.query('SELECT * FROM client_accounts WHERE username=$1',[body.username]);const calculated=await derive(body.password,a?.salt??'00000000000000000000000000000000',64) as Buffer;if(!timingSafeEqual(calculated,a?.verifier??Buffer.alloc(64))||!a)throw new UnauthorizedException();return this.session(a.id,res,a.verifier);}
 @Post('recovery/code') @Header('Cache-Control','no-store') async issueCode(@Headers('cookie') cookie:string,@Body() body:PasswordCheck){
   const a=await this.account(cookie);const [row]=await this.db.query('SELECT salt,verifier FROM client_accounts WHERE id=$1',[a.id]);
   const check=await derive(body.password,row.salt,64) as Buffer;if(!timingSafeEqual(check,row.verifier))throw new ForbiddenException();
   const code=randomBytes(20).toString('hex');const updated=await this.db.query('WITH u AS (UPDATE client_accounts SET recovery_hash=$1 WHERE id=$2 AND verifier=$3 RETURNING id) SELECT id FROM u',[digest(code),a.id,check]);if(!updated.length)throw new UnauthorizedException();return {code};
 }
 @Post('recovery/reset') @Header('Cache-Control','no-store') async recover(@Body() body:RecoveryInput){
   const salt=randomBytes(16).toString('hex'),verifier=await derive(body.password,salt,64);
   await this.db.transaction(async m=>{const rows=await m.query('WITH u AS (UPDATE client_accounts SET salt=$1,verifier=$2,recovery_hash=NULL WHERE username=$3 AND recovery_hash=$4 RETURNING id) SELECT id FROM u',[salt,verifier,body.username,digest(body.code)]);if(!rows.length)throw new UnauthorizedException();await m.query('DELETE FROM client_sessions WHERE client_id=$1',[rows[0].id]);});return {ok:true};
 }
 @Post('logout') async logout(@Headers('cookie') cookie:string,@Res({passthrough:true}) res:Response){await this.db.query('DELETE FROM client_sessions WHERE token_hash=$1',[sessionHash(cookie)]);res.clearCookie(cookieName,cookieOptions);return {ok:true};}
 @Get('academy/:id/exam') @Header('Cache-Control','no-store') async questions(@Param('id',ParseUUIDPipe) id:string,@Headers('cookie') cookie:string){return exam(this.db,id,(await this.account(cookie)).id)}
 @Post('academy/:id/exam') async grade(@Param('id',ParseUUIDPipe) id:string,@Headers('cookie') cookie:string,@Body() body:ExamAnswers){return exam(this.db,id,(await this.account(cookie)).id,body.answers)}
 @Post('academy/:id/checkout') async tuition(@Param('id',ParseUUIDPipe) id:string,@Headers('cookie') cookie:string){return tuitionCheckout(this.db,id,(await this.account(cookie)).id)}
 @Post('academy/:id/enrol') async joinCourse(@Param('id',ParseUUIDPipe) id:string,@Headers('cookie') cookie:string){return enrol(this.db,id,(await this.account(cookie)).id)}
 @Get('library') @Header('Cache-Control','no-store') async library(@Headers('cookie') cookie:string){return savedCourses(this.db,(await this.account(cookie)).id)}
 @Post('library/:course') async save(@Headers('cookie') cookie:string,@Param('course') course:string){return updateLibrary(this.db,(await this.account(cookie)).id,course,true)}
 @Delete('library/:course') async unsave(@Headers('cookie') cookie:string,@Param('course') course:string){return updateLibrary(this.db,(await this.account(cookie)).id,course,false)}
 @Get() @Header('Cache-Control','no-store') async dashboard(@Headers('cookie') cookie:string){const a=await this.account(cookie);const holds=await this.db.query(`SELECT id,service,mode,starts_at,ends_at,fee_irr,hold_until,${branchInfo} FROM appointment_slots WHERE held_by=$1 AND NOT withdrawn AND hold_until>now() ORDER BY starts_at`,[a.id]);const confirmed=await this.db.query(`SELECT appointment_slots.id,service,mode,starts_at,ends_at,${branchInfo},(SELECT CASE WHEN decision IS NOT NULL THEN decision WHEN reviewer IS NULL THEN 'pending' ELSE 'seen' END FROM cancellation_requests WHERE quote_id=q.id) AS cancellation,q.id AS quote,q.amount_irr AS fee_irr,coalesce(p.reference,c2.reference) AS reference FROM appointment_slots JOIN booking_quotes q ON q.id=confirmed_quote LEFT JOIN gateway_payments p ON p.quote_id=q.id LEFT JOIN cash_receipts c2 ON c2.quote_id=q.id WHERE q.client_id=$1 AND ends_at>now() ORDER BY starts_at`,[a.id]);const past=await this.db.query(`SELECT s.id,s.service,s.starts_at,s.mode,(SELECT status FROM attendance_events WHERE slot_id=s.id ORDER BY revision DESC LIMIT 1) AS status FROM appointment_slots s JOIN booking_quotes q ON q.id=s.confirmed_quote WHERE q.client_id=$1 AND s.ends_at<=now() ORDER BY s.starts_at DESC,s.id LIMIT 20`,[a.id]);return {username:a.username,tuition:await this.db.query(`SELECT c.course,t.amount_irr,t.state,t.reference,t.expires_at,t.outcome FROM tuition_payments t JOIN academy_cohorts c ON c.id=t.cohort WHERE t.client_id=$1 ORDER BY t.created_at DESC LIMIT 20`,[a.id]),enrolments:await myCourses(this.db,a.id),library:await savedCourses(this.db,a.id),decisions:await cancellationResults(this.db,a.id),moves:await recentMoves(this.db,a.id),holds,confirmed,past,payment_enabled:paymentEnabled(),quotes:await recentQuotes(this.db,a.id)};}
 @Post('quotes/:id/cancellation') async cancelRequest(@Headers('cookie') cookie:string,@Param('id',ParseUUIDPipe) id:string){const a=await this.account(cookie);return requestCancellation(this.db,a.id,id);}
 @Post('quotes/:id/checkout') @Header('Cache-Control','no-store') async checkout(@Headers('cookie') cookie:string,@Param('id',ParseUUIDPipe) id:string){const a=await this.account(cookie);return checkout(this.db,a.id,id);}
 @Post('quotes/:id/meeting') async meeting(@Headers('cookie') cookie:string,@Param('id',ParseUUIDPipe) id:string){return meetingRoom(this.db,id,(await this.account(cookie)).id)}
 @Post('quotes/:id/recheck') async recheck(@Headers('cookie') cookie:string,@Param('id',ParseUUIDPipe) id:string){const a=await this.account(cookie);const [p]=await this.db.query('SELECT authority FROM gateway_payments p JOIN booking_quotes q ON q.id=p.quote_id WHERE q.id=$1 AND q.client_id=$2',[id,a.id]);if(!p)throw new NotFoundException();return {state:await reconcile(this.db,p.authority)};}
 @Post('holds/:id/quote') @Header('Cache-Control','no-store') async quote(@Headers('cookie') cookie:string,@Param('id',ParseUUIDPipe) id:string){const a=await this.account(cookie);return issueQuote(this.db,a.id,id);}
 @Post('holds') async link(@Headers('cookie') cookie:string,@Body() body:LinkHold){const a=await this.account(cookie);const rows=await this.db.query('WITH u AS (UPDATE appointment_slots SET held_by=$1 WHERE hold_hash=$2 AND held_by IS NULL AND NOT withdrawn AND hold_until>now() RETURNING id) SELECT id FROM u',[a.id,digest(body.token)]);if(!rows.length)throw new ConflictException();return rows[0];}
 @Delete('holds/:id') async release(@Headers('cookie') cookie:string,@Param('id',ParseUUIDPipe) id:string){const a=await this.account(cookie);const rows=await this.db.query('WITH u AS (UPDATE appointment_slots SET hold_hash=NULL,hold_until=NULL,held_by=NULL WHERE id=$1 AND held_by=$2 AND hold_until>now() RETURNING id) SELECT id FROM u',[id,a.id]);if(!rows.length)throw new NotFoundException();return {ok:true};}
}
