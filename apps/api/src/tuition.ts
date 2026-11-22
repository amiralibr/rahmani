import {BadGatewayException,BadRequestException,Body,ConflictException,Controller,Get,Header,Inject,NotFoundException,Param,Patch,Query,Redirect,Req,ServiceUnavailableException,UseGuards} from '@nestjs/common';
import {IsIn} from 'class-validator';
import {ReceptionGuard} from './reception';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
import {gateway,paymentEnabled,startPay} from './payments';
export const tuitionEnabled=()=>process.env.ACADEMY_CHECKOUT==='enabled'&&paymentEnabled();
export class Tuition1795046400025 implements MigrationInterface{
 async up(q:QueryRunner){await q.query(`CREATE TABLE tuition_payments(authority text PRIMARY KEY,cohort uuid NOT NULL REFERENCES academy_cohorts(id),client_id uuid NOT NULL REFERENCES client_accounts(id),amount_irr integer NOT NULL CHECK(amount_irr>0),expires_at timestamptz NOT NULL,state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','confirmed','review')),reference text UNIQUE,created_at timestamptz NOT NULL DEFAULT now())`);await q.query('CREATE INDEX tuition_capacity ON tuition_payments(cohort,expires_at) WHERE state=\'pending\'');}
 async down(q:QueryRunner){await q.query('DROP TABLE tuition_payments')}
}
export class TuitionReviews1795046400027 implements MigrationInterface{
 async up(q:QueryRunner){await q.query(`ALTER TABLE tuition_payments ADD claimed_by uuid REFERENCES staff_accounts(id), ADD claimed_at timestamptz, ADD outcome text CHECK(outcome IN ('admitted','rejected')), ADD resolved_by uuid REFERENCES staff_accounts(id), ADD resolved_at timestamptz`)}
 async down(q:QueryRunner){await q.query('ALTER TABLE tuition_payments DROP resolved_at,DROP resolved_by,DROP outcome,DROP claimed_at,DROP claimed_by')}
}
export const reserved=`(SELECT count(*)::int FROM tuition_payments t WHERE t.cohort=c.id AND t.state='pending' AND t.expires_at>clock_timestamp())`;
export function tuitionCheckout(db:DataSource,id:string,client:string){if(!tuitionEnabled())throw new ServiceUnavailableException();return db.transaction(async m=>{
 const [c]=await m.query('SELECT fee_irr,starts_at FROM academy_cohorts WHERE id=$1 AND starts_at>clock_timestamp() AND fee_irr>0 FOR UPDATE',[id]);if(!c)throw new ConflictException();
 const [old]=await m.query(`SELECT authority,state FROM tuition_payments WHERE cohort=$1 AND client_id=$2 AND (state<>'pending' OR expires_at>clock_timestamp()) ORDER BY created_at DESC LIMIT 1`,[id,client]);if(old){if(old.state!=='pending')throw new ConflictException();return {url:startPay+old.authority}}
 const [space]=await m.query(`SELECT 1 FROM academy_cohorts c WHERE id=$1 AND capacity>${reserved}+(SELECT count(*) FROM academy_enrolments WHERE cohort=$1)`,[id]);if(!space)throw new ConflictException();
 const result=await gateway('request',{amount:c.fee_irr,currency:'IRR',description:'Rahmani Academy tuition',callback_url:process.env.PUBLIC_ORIGIN+'/api/v1/academy-payments/return'});if(result.code!==100||!/^A[a-zA-Z0-9]{35}$/.test(result.authority))throw new BadGatewayException();await m.query(`INSERT INTO tuition_payments(authority,cohort,client_id,amount_irr,expires_at) VALUES($1,$2,$3,$4,least(clock_timestamp()+interval '10 minutes',$5))`,[result.authority,id,client,c.fee_irr,c.starts_at]);return {url:startPay+result.authority};});}
export async function verifyTuition(db:DataSource,authority:string){if(typeof authority!=='string'||!/^A[a-zA-Z0-9]{35}$/.test(authority))throw new NotFoundException();return db.transaction(async m=>{
 const [c]=await m.query('SELECT c.id FROM academy_cohorts c JOIN tuition_payments t ON t.cohort=c.id WHERE authority=$1 FOR UPDATE OF c',[authority]);if(!c)throw new NotFoundException();const [p]=await m.query('SELECT * FROM tuition_payments WHERE authority=$1',[authority]);if(p.state!=='pending')return p.state;
 const v=await gateway('verify',{authority,amount:p.amount_irr});if(![100,101].includes(v.code)||!/^\d{1,24}$/.test(String(v.ref_id))||String(v.ref_id)==='0')throw new BadGatewayException();const rows=await m.query(`INSERT INTO academy_enrolments(cohort,client_id) SELECT cohort,client_id FROM tuition_payments WHERE authority=$1 AND expires_at>clock_timestamp() ON CONFLICT DO NOTHING RETURNING cohort`,[authority]);const state=rows.length?'confirmed':'review';await m.query('UPDATE tuition_payments SET state=$2,reference=$3 WHERE authority=$1',[authority,state,String(v.ref_id)]);return state;});}
export const tuitionAuthority=/^A[a-zA-Z0-9]{35}$/;
export function reviewList(db:DataSource,resolved:boolean){return db.query(`SELECT t.authority,t.amount_irr,t.reference,t.created_at,t.claimed_at,t.outcome,c.course,c.instructor,c.starts_at,c.capacity,(SELECT count(*)::int FROM academy_enrolments WHERE cohort=c.id) AS enrolled,u.username AS claimed_by FROM tuition_payments t JOIN academy_cohorts c ON c.id=t.cohort LEFT JOIN staff_accounts u ON u.id=t.claimed_by WHERE t.state='review' AND (t.outcome IS NOT NULL)=$1 ORDER BY t.created_at LIMIT 20`,[resolved])}
export function claimReview(db:DataSource,authority:string,staff:string){if(!tuitionAuthority.test(authority))throw new BadRequestException();return db.query(`WITH u AS (UPDATE tuition_payments SET claimed_by=$2,claimed_at=now() WHERE authority=$1 AND state='review' AND outcome IS NULL AND claimed_by IS NULL RETURNING authority) SELECT * FROM u`,[authority,staff]).then(r=>{if(!r.length)throw new ConflictException();return {ok:true}})}
export function resolveReview(db:DataSource,authority:string,staff:string,outcome:'admitted'|'rejected'){if(!tuitionAuthority.test(authority))throw new BadRequestException();return db.transaction(async m=>{
 const [p]=await m.query('SELECT t.*,starts_at FROM tuition_payments t JOIN academy_cohorts c ON c.id=t.cohort WHERE authority=$1 FOR UPDATE OF t',[authority]);if(!p||p.state!=='review'||p.outcome)throw new ConflictException();if(p.claimed_by!==staff)throw new ConflictException();
 if(outcome==='admitted'){if(new Date(p.starts_at)<=new Date())throw new ConflictException();await m.query('INSERT INTO academy_enrolments(cohort,client_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[p.cohort,p.client_id]);}
 await m.query("UPDATE tuition_payments SET outcome=$2,resolved_by=$3,resolved_at=now() WHERE authority=$1",[authority,outcome,staff]);return {ok:true};})}
class tuitionOutcome{@IsIn(['admitted','rejected']) outcome!:'admitted'|'rejected'}
@UseGuards(ReceptionGuard) @Controller('api/v1/academy/tuition-reviews') export class TuitionReviewsController{constructor(@Inject(DataSource) private db:DataSource){}
 @Get() @Header('Cache-Control','no-store') list(@Query('resolved') r='false'){if(!/^(true|false)$/.test(r))throw new BadRequestException();return reviewList(this.db,r==='true')}
 @Patch(':authority/claim') claim(@Param('authority') a:string,@Req() req:{staff:{id:string}}){return claimReview(this.db,a,req.staff.id)}
 @Patch(':authority/outcome') resolve(@Param('authority') a:string,@Body() b:tuitionOutcome,@Req() req:{staff:{id:string}}){return resolveReview(this.db,a,req.staff.id,b.outcome)}
}
@Controller('api/v1/academy-payments') export class TuitionController{constructor(@Inject(DataSource) private db:DataSource){} @Get('return') @Header('Cache-Control','no-store') @Redirect('/account/',303) async callback(@Query('Authority') a:string,@Query('Status') s:string){if(s==='OK')await verifyTuition(this.db,a);return {url:'/account/'}}}
