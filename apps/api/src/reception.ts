import {receptionReport} from './reception-report';
import { Body, CanActivate, ConflictException, Controller, ExecutionContext, Get, Header, Inject, Injectable, Param, ParseUUIDPipe, Patch, Query, UnauthorizedException, UseGuards, BadRequestException, Req, ForbiddenException } from '@nestjs/common';
import { digest } from './staff';
import { IsIn } from 'class-validator';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
const states=['new','in_progress','closed'];
export class ReceptionSchema1795046400001 implements MigrationInterface {
 async up(q:QueryRunner){await q.query(`ALTER TABLE contact_requests ADD COLUMN status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','closed'))`);await q.query('CREATE INDEX contact_status_created ON contact_requests(status,created_at DESC,id DESC)');}
 async down(q:QueryRunner){await q.query('DROP INDEX contact_status_created');await q.query('ALTER TABLE contact_requests DROP COLUMN status');}
}
@Injectable() export class ReceptionGuard implements CanActivate {
 constructor(@Inject(DataSource) private db:DataSource){}
 async canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest();const header=req.headers.authorization;
 if(typeof header!=='string'||!/^Bearer [a-f0-9]{64}$/.test(header))throw new UnauthorizedException();
 const [staff]=await this.db.query('SELECT a.id,a.role FROM staff_accounts a JOIN staff_sessions s ON s.staff_id=a.id WHERE a.active AND s.expires_at>now() AND s.token_hash=$1',[digest(header.slice(7))]);
 if(!staff)throw new UnauthorizedException();if(!['GET','HEAD'].includes(req.method)&&staff.role!=='reception')throw new ForbiddenException();req.staff=staff;return true;}
}
class UpdateStatus { @IsIn(states) previous!:string; @IsIn(states) status!:string; }
@Controller('api/v1/reception') @UseGuards(ReceptionGuard)
export class ReceptionController {
 constructor(@Inject(DataSource) private db:DataSource){}
 @Get() @Header('Cache-Control','no-store') async list(@Query('status') status='new',@Query('page') page='0'){
 if(!states.includes(status)||!/^\d{1,6}$/.test(page))throw new BadRequestException();
 const rows=await this.db.query('SELECT id,email,topic,locale,created_at,status FROM contact_requests WHERE status=$1 ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET $2',[status,Number(page)*20]);return {items:rows.slice(0,20),more:rows.length>20};}
 @Get('report') @Header('Cache-Control','no-store') report(){return receptionReport(this.db);}
 @Get(':id/history') @Header('Cache-Control','no-store') async history(@Param('id',ParseUUIDPipe) id:string){
   return this.db.query('SELECT e.kind,e.previous,e.status,e.at,a.username AS actor FROM contact_status_events e LEFT JOIN staff_accounts a ON a.id=e.actor_id WHERE e.request_id=$1 ORDER BY e.id DESC LIMIT 50',[id]);
 }
 @Patch(':id') @Header('Cache-Control','no-store') async change(@Param('id',ParseUUIDPipe) id:string,@Body() body:UpdateStatus,@Req() req:{staff:{id:string}}){
 return this.db.transaction(async m=>{await m.query("SELECT set_config('rahmani.actor',$1,true)",[req.staff.id]);
 const rows=await m.query('WITH updated AS (UPDATE contact_requests SET status=$1 WHERE id=$2 AND status=$3 RETURNING id) SELECT id FROM updated',[body.status,id,body.previous]);if(!rows.length)throw new ConflictException('Refresh the queue');return {updated:true};});}
}
