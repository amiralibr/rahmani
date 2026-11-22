import {BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,Header,Inject,Injectable,CanActivate,ExecutionContext,NotFoundException,Param,ParseUUIDPipe,Post,Query,Req,ServiceUnavailableException,UseGuards} from '@nestjs/common';
import {IsIn,IsUUID,Length} from 'class-validator';
import {createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
import {digest} from './staff';
export class Clinical1795046400034 implements MigrationInterface{
 async up(q:QueryRunner){await q.query('CREATE SCHEMA IF NOT EXISTS clinical');
  await q.query(`CREATE TABLE clinical.records(id uuid PRIMARY KEY,slot_id uuid NOT NULL REFERENCES appointment_slots(id) ON DELETE RESTRICT,professional_id uuid NOT NULL REFERENCES staff_accounts(id),record_type text NOT NULL CHECK(record_type IN ('session','intake','note')),ciphertext text NOT NULL CHECK(char_length(ciphertext)<6000),created_at timestamptz NOT NULL DEFAULT now())`);
  await q.query('CREATE INDEX clinical_records_slot ON clinical.records(slot_id,created_at)');
  await q.query(`CREATE TABLE clinical.access_log(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,record_id uuid REFERENCES clinical.records(id) ON DELETE CASCADE,slot_id uuid,actor uuid REFERENCES staff_accounts(id),action text NOT NULL CHECK(action IN ('create','list','read')),at timestamptz NOT NULL DEFAULT now())`);}
 async down(q:QueryRunner){await q.query('DROP TABLE clinical.access_log');await q.query('DROP TABLE clinical.records');await q.query('DROP SCHEMA clinical')}
}
/** Key: base64-encoded 32 bytes from CLINICAL_KEY. Missing/invalid key disables the module safely. */
function key():Buffer{const raw=process.env.CLINICAL_KEY;const k=raw?Buffer.from(raw,'base64'):Buffer.alloc(0);if(k.length!==32)throw new ServiceUnavailableException('Clinical module not configured');return k}
function encrypt(plain:string){const iv=randomBytes(12);const c=createCipheriv('aes-256-gcm',key(),iv);const ct=Buffer.concat([c.update(plain,'utf8'),c.final()]);return [iv.toString('base64'),c.getAuthTag().toString('base64'),ct.toString('base64')].join('.')}
function decrypt(payload:string){const [a,b,c]=payload.split('.');if(!a||!b||!c)throw new BadRequestException('Record unreadable');try{const d=createDecipheriv('aes-256-gcm',key(),Buffer.from(a,'base64'));d.setAuthTag(Buffer.from(b,'base64'));return Buffer.concat([d.update(Buffer.from(c,'base64')),d.final()]).toString('utf8')}catch{throw new BadRequestException('Record unreadable')}}
@Injectable() export class ClinicalGuard implements CanActivate{
 constructor(@Inject(DataSource) private db:DataSource){}
 async canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest();const header=req.headers.authorization;
  if(typeof header!=='string'||!/^Bearer [a-f0-9]{64}$/.test(header))throw new ForbiddenException();
  const [staff]=await this.db.query('SELECT a.id,a.role FROM staff_accounts a JOIN staff_sessions s ON s.staff_id=a.id WHERE a.active AND s.expires_at>now() AND s.token_hash=$1',[digest(header.slice(7))]);
  if(!staff||staff.role!=='specialist')throw new ForbiddenException();req.staff=staff;return true;}}
class NewRecord{@IsUUID() slot_id!:string; @IsIn(['session','intake','note']) record_type!:string; @Length(1,4000) content!:string}
@Controller('api/v1/clinical') @UseGuards(ClinicalGuard) export class ClinicalController{constructor(@Inject(DataSource) private db:DataSource){}
 @Post('records') @Header('Cache-Control','no-store') async create(@Body() b:NewRecord,@Req() req:{staff:{id:string}}){
  const [slot]=await this.db.query('SELECT id FROM appointment_slots WHERE id=$1 AND confirmed_quote IS NOT NULL',[b.slot_id]);if(!slot)throw new ConflictException('Session not confirmed');
  const id=randomUUID();await this.db.transaction(async m=>{await m.query('INSERT INTO clinical.records(id,slot_id,professional_id,record_type,ciphertext) VALUES($1,$2,$3,$4,$5)',[id,b.slot_id,req.staff.id,b.record_type,encrypt(b.content)]);await m.query("INSERT INTO clinical.access_log(record_id,slot_id,actor,action) VALUES($1,$2,$3,'create')",[id,b.slot_id,req.staff.id])});return {id};}
 @Get('records') @Header('Cache-Control','no-store') async list(@Query('slot_id',ParseUUIDPipe) slot:string,@Req() req:{staff:{id:string}}){
  const rows=await this.db.query('SELECT id,record_type,created_at FROM clinical.records WHERE slot_id=$1 ORDER BY created_at',[slot]);
  await this.db.query("INSERT INTO clinical.access_log(slot_id,actor,action) VALUES($1,$2,'list')",[slot,req.staff.id]);return rows;}
 @Get('records/:id') @Header('Cache-Control','no-store') async read(@Param('id',ParseUUIDPipe) id:string,@Req() req:{staff:{id:string}}){
  const [row]=await this.db.query('SELECT id,slot_id,record_type,ciphertext,created_at FROM clinical.records WHERE id=$1',[id]);if(!row)throw new NotFoundException();
  await this.db.query("INSERT INTO clinical.access_log(record_id,slot_id,actor,action) VALUES($1,$2,$3,'read')",[id,row.slot_id,req.staff.id]);
  return {id:row.id,slot_id:row.slot_id,record_type:row.record_type,created_at:row.created_at,content:decrypt(row.ciphertext)};}}
