import {compareStatement,StatementInput} from './statement';
import {inquiryStep,claimMismatch,recordFinding} from './mismatch';
import {refundReport} from './refund-report';
import {recordReceipt,authorizeRecommendation,financialCases,finishReview,startReview} from './finance-review';
import {decideCancellation,acknowledgeCancellation} from './cancellation';
import {alternatives,MoveInput,reschedule} from './reschedule';
import {BadRequestException,Body,ConflictException,Controller,Get,Header,Inject,Param,ParseUUIDPipe,Post,HttpCode,Patch,Query,Req,UseGuards} from '@nestjs/common';
import {Matches,IsIn,IsInt,IsUUID,Max,Min} from 'class-validator';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
import {ReceptionGuard} from './reception';
const allowed=['attended','absent'];
export class Attendance1795046400013 implements MigrationInterface{
 async up(q:QueryRunner){await q.query(`CREATE TABLE attendance_events(slot_id uuid NOT NULL REFERENCES appointment_slots(id),revision integer NOT NULL CHECK(revision>0),status text NOT NULL CHECK(status IN ('attended','absent')),actor uuid NOT NULL REFERENCES staff_accounts(id),recorded_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(slot_id,revision))`);}
 async down(q:QueryRunner){await q.query('DROP TABLE attendance_events');}
}
class Finding { @IsIn(['escalated','documents_requested']) outcome!:string; }
class Authorization { @IsIn(['approved','rejected']) decision!:'approved'|'rejected'; }
class Recommendation { @IsInt() @Min(0) @Max(2147483647) amount!:number; }
class Receipt extends Recommendation { @Matches(/^[a-zA-Z0-9-]{4,64}$/) reference!:string; }
class CloseInquiry { @Matches(/^[1-9][0-9]{0,18}$/) reply!:string; }
class Decision { @IsUUID() quote!:string; @IsIn(['approved','declined']) decision!:'approved'|'declined'; }
class Mark { @IsIn(allowed) status!:string; @IsInt() @Min(0) revision!:number; }
@Controller('api/v1/reception/sessions') @UseGuards(ReceptionGuard) export class AttendanceController{
 constructor(@Inject(DataSource) private db:DataSource){}
 @Get() @Header('Cache-Control','no-store') async sessions(@Query('period') period='upcoming',@Query('page') page='0'){
 if(!['upcoming','past'].includes(period)||!/^\d{1,6}$/.test(page))throw new BadRequestException();const past=period==='past';
 const rows=await this.db.query(`SELECT (SELECT CASE WHEN decision IS NOT NULL THEN decision WHEN reviewer IS NULL THEN 'pending' ELSE 'seen' END FROM cancellation_requests WHERE quote_id=s.confirmed_quote) AS cancellation,s.id,s.confirmed_quote AS quote,s.service,s.mode,s.starts_at,s.ends_at,c.username,e.status,coalesce(e.revision,0) AS revision,e.recorded_at,staff.username AS operator FROM appointment_slots s JOIN booking_quotes q ON q.id=s.confirmed_quote JOIN client_accounts c ON c.id=q.client_id LEFT JOIN LATERAL (SELECT * FROM attendance_events WHERE slot_id=s.id ORDER BY revision DESC LIMIT 1)e ON true LEFT JOIN staff_accounts staff ON staff.id=e.actor WHERE s.ends_at ${past?'<=':'>'} now() ORDER BY s.starts_at ${past?'DESC':'ASC'},s.id LIMIT 21 OFFSET $1`,[Number(page)*20]);return {items:rows.slice(0,20),more:rows.length>20};}
 @Patch('finance/:quote/reply') reply(@Param('quote',ParseUUIDPipe) q:string,@Req() req:{staff:{id:string}},@Body() body:Receipt){return inquiryStep(this.db,q,req.staff.id,body);}
 @Patch('finance/:quote/close') close(@Param('quote',ParseUUIDPipe) q:string,@Req() req:{staff:{id:string}},@Body() body:CloseInquiry){return inquiryStep(this.db,q,req.staff.id,body);}
 @Patch('finance/:quote/inquiry') claimInquiry(@Param('quote',ParseUUIDPipe) quote:string,@Req() req:{staff:{id:string}}){return claimMismatch(this.db,quote,req.staff.id);}
 @Patch('finance/:quote/finding') finding(@Param('quote',ParseUUIDPipe) quote:string,@Req() req:{staff:{id:string}},@Body() body:Finding){return recordFinding(this.db,quote,req.staff.id,body.outcome);}
 @Post('finance/statement') @HttpCode(200) @Header('Cache-Control','no-store') statement(@Req() req:{staff:{id:string}},@Body() input:StatementInput){return compareStatement(this.db,req.staff.id,input.rows);}
 @Get('finance/report') @Header('Cache-Control','no-store') report(@Req() req:{staff:{id:string}},@Query('category') category='missing',@Query('page') page='0'){if(!['missing','recorded','mismatch','closed'].includes(category)||!/^\d{1,6}$/.test(page))throw new BadRequestException();return refundReport(this.db,category,Number(page),req.staff.id);}
 @Get('finance') @Header('Cache-Control','no-store') finance(@Req() req:{staff:{id:string}},@Query('state') state='pending',@Query('page') page='0'){if(!['pending','started','finished'].includes(state)||!/^\d{1,6}$/.test(page))throw new BadRequestException();return financialCases(this.db,state!=='pending',Number(page),state==='finished',req.staff.id);}
 @Patch('finance/:quote/receipt') receipt(@Param('quote',ParseUUIDPipe) quote:string,@Body() body:Receipt,@Req() req:{staff:{id:string}}){return recordReceipt(this.db,quote,req.staff.id,body.amount,body.reference);}
 @Patch('finance/:quote/authorization') authorize(@Param('quote',ParseUUIDPipe) quote:string,@Body() body:Authorization,@Req() req:{staff:{id:string}}){return authorizeRecommendation(this.db,quote,req.staff.id,body.decision);}
 @Patch('finance/:quote/result') finish(@Param('quote',ParseUUIDPipe) quote:string,@Body() body:Recommendation,@Req() req:{staff:{id:string}}){return finishReview(this.db,quote,req.staff.id,body.amount);}
 @Patch('finance/:quote') start(@Param('quote',ParseUUIDPipe) quote:string,@Req() req:{staff:{id:string}}){return startReview(this.db,quote,req.staff.id);}
 @Get(':id/alternatives') @Header('Cache-Control','no-store') alternatives(@Param('id',ParseUUIDPipe) id:string){return alternatives(this.db,id);}
 @Patch(':id/acknowledge-cancellation') acknowledge(@Param('id',ParseUUIDPipe) quote:string,@Req() req:{staff:{id:string}}){return acknowledgeCancellation(this.db,quote,req.staff.id);}
 @Patch(':id/cancellation-decision') decide(@Param('id',ParseUUIDPipe) id:string,@Body() body:Decision,@Req() req:{staff:{id:string}}){return decideCancellation(this.db,id,body.quote,body.decision,req.staff.id);}
 @Patch(':id/move') @Header('Cache-Control','no-store') move(@Param('id',ParseUUIDPipe) id:string,@Body() input:MoveInput,@Req() req:{staff:{id:string}}){return reschedule(this.db,id,input,req.staff.id);}
 @Patch(':id') @Header('Cache-Control','no-store') async mark(@Param('id',ParseUUIDPipe) id:string,@Body() body:Mark,@Req() req:{staff:{id:string}}){return this.db.transaction(async m=>{
 const [slot]=await m.query('SELECT id FROM appointment_slots WHERE id=$1 AND confirmed_quote IS NOT NULL AND ends_at<=now() FOR UPDATE',[id]);if(!slot)throw new ConflictException('Only completed confirmed sessions can be marked');
 const [last]=await m.query('SELECT revision,status FROM attendance_events WHERE slot_id=$1 ORDER BY revision DESC LIMIT 1',[id]);if((last?.revision??0)!==body.revision)throw new ConflictException('Reload this session');if(last?.status!==body.status)await m.query('INSERT INTO attendance_events(slot_id,revision,status,actor) VALUES($1,$2,$3,$4)',[id,body.revision+1,body.status,req.staff.id]);return {ok:true};});}
}
