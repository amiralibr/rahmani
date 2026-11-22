import {BadRequestException,ConflictException,Body,Controller,Get,Header,Inject,Injectable,NotFoundException,Param,ParseUUIDPipe,Patch,Query,Req,UseGuards,CanActivate,ExecutionContext,ForbiddenException} from '@nestjs/common';
import {DataSource} from 'typeorm';
import {digest} from './staff';
@Injectable() export class SpecialistGuard implements CanActivate{
 constructor(@Inject(DataSource) private db:DataSource){}
 async canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest();const header=req.headers.authorization;
  if(typeof header!=='string'||!/^Bearer [a-f0-9]{64}$/.test(header))throw new ForbiddenException();
  const [staff]=await this.db.query('SELECT a.id,a.role FROM staff_accounts a JOIN staff_sessions s ON s.staff_id=a.id WHERE a.active AND s.expires_at>now() AND s.token_hash=$1',[digest(header.slice(7))]);
  if(!staff||staff.role!=='specialist')throw new ForbiddenException();req.staff=staff;return true;}
}
@Injectable() export class ManagerGuard implements CanActivate{
 constructor(@Inject(DataSource) private db:DataSource){}
 async canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest();const header=req.headers.authorization;
  if(typeof header!=='string'||!/^Bearer [a-f0-9]{64}$/.test(header))throw new ForbiddenException();
  const [staff]=await this.db.query('SELECT a.id,a.role FROM staff_accounts a JOIN staff_sessions s ON s.staff_id=a.id WHERE a.active AND s.expires_at>now() AND s.token_hash=$1',[digest(header.slice(7))]);
  if(!staff||staff.role!=='manager')throw new ForbiddenException();req.staff=staff;return true;}
}
// Read-only professional workspace. Contains schedule and aggregate earnings only; no clinical data.
@Controller('api/v1/specialist') @UseGuards(SpecialistGuard) export class SpecialistController{constructor(@Inject(DataSource) private db:DataSource){}
 @Get('sessions') @Header('Cache-Control','no-store') async sessions(@Query('period') period='upcoming',@Query('page') page='0'){
  if(!['upcoming','past'].includes(period)||!/^\d{1,6}$/.test(page))throw new BadRequestException();const past=period==='past';
  const rows=await this.db.query(`SELECT s.id,s.service,s.mode,s.starts_at,s.ends_at,c.username,(SELECT status FROM attendance_events WHERE slot_id=s.id ORDER BY revision DESC LIMIT 1) AS status FROM appointment_slots s JOIN booking_quotes q ON q.id=s.confirmed_quote JOIN client_accounts c ON c.id=q.client_id WHERE s.ends_at ${past?'<=':'>'} now() ORDER BY s.starts_at ${past?'DESC':'ASC'},s.id LIMIT 21 OFFSET $1`,[Number(page)*20]);return {items:rows.slice(0,20),more:rows.length>20};}
 @Get('earnings') @Header('Cache-Control','no-store') earnings(){return this.db.query(`SELECT to_char(d,'YYYY-MM') AS month,count(*)::int AS sessions,coalesce(sum(total),0)::bigint AS total_irr FROM (SELECT verified_at AS d,q.amount_irr AS total FROM gateway_payments p JOIN booking_quotes q ON q.id=p.quote_id WHERE p.state='confirmed' AND p.verified_at>now()-interval '12 months' UNION ALL SELECT recorded_at,amount_irr FROM cash_receipts WHERE recorded_at>now()-interval '12 months') s GROUP BY 1 ORDER BY 1 DESC`)}
}
// Oversight workspace: aggregates and account activation. No clinical data, no money movement.
@Controller('api/v1/manager') @UseGuards(ManagerGuard) export class ManagerController{constructor(@Inject(DataSource) private db:DataSource){}
 @Get('overview') @Header('Cache-Control','no-store') async overview(){
  const q=(sql:string)=>this.db.query(sql);
  const [[week],[money],[refunds],[upcoming],[academy],[reviews],[cancels]]=await Promise.all([
   q("SELECT count(*)::int AS n,count(*) FILTER (WHERE status='new')::int AS fresh FROM contact_requests WHERE created_at>now()-interval '7 days'"),
   q("SELECT count(*)::int AS n,coalesce(sum(total),0)::bigint AS total_irr FROM (SELECT verified_at AS d,q.amount_irr AS total FROM gateway_payments p JOIN booking_quotes q ON q.id=p.quote_id WHERE p.state='confirmed' AND p.verified_at>date_trunc('month',now()) UNION ALL SELECT recorded_at,amount_irr FROM cash_receipts WHERE recorded_at>date_trunc('month',now())) s"),
   q("SELECT count(*)::int AS n,coalesce(sum(amount_irr),0)::bigint AS total_irr FROM refund_receipts WHERE recorded_at>date_trunc('month',now())"),
   q("SELECT count(*)::int AS n FROM appointment_slots WHERE confirmed_quote IS NOT NULL AND NOT withdrawn AND ends_at>now()"),
   q("SELECT count(*)::int AS n FROM academy_enrolments"),
   q("SELECT count(*)::int AS n FROM tuition_payments WHERE state='review' AND outcome IS NULL"),
   q("SELECT count(*)::int AS n FROM cancellation_requests WHERE decision IS NULL"),
  ]);
  return {contacts_week:week.n,contacts_fresh:week.fresh,payments_month_count:money.n,payments_month_irr:money.total_irr,refunds_month_count:refunds.n,refunds_month_irr:refunds.total_irr,upcoming_sessions:upcoming.n,academy_enrolments:academy.n,tuition_reviews_open:reviews.n,cancellations_open:cancels.n};}
 @Get('staff') @Header('Cache-Control','no-store') staff(){return this.db.query('SELECT id,username,role,active,refund_approver FROM staff_accounts ORDER BY role,username')}
 @Patch('staff/:id/active') @Header('Cache-Control','no-store') async setActive(@Param('id',ParseUUIDPipe) id:string,@Req() req:{staff:{id:string}},@Body() body:{active:boolean}){
  if(typeof body?.active!=='boolean')throw new BadRequestException();if(req.staff.id===id)throw new ConflictException('Cannot change own account');
  const rows=await this.db.query("WITH u AS (UPDATE staff_accounts SET active=$2 WHERE id=$1 AND role<>'manager' RETURNING id) SELECT id FROM u",[id,body.active]);if(!rows.length)throw new NotFoundException();
  if(!body.active)await this.db.query('DELETE FROM staff_sessions WHERE staff_id=$1',[id]);return {ok:true};}
}
