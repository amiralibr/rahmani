import {BadGatewayException,ConflictException,Controller,Get,Header,Inject,NotFoundException,Query,Redirect,ServiceUnavailableException} from '@nestjs/common';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';

export class Payments1795046400012 implements MigrationInterface {
 async up(q:QueryRunner){await q.query(`CREATE TABLE gateway_payments(quote_id uuid PRIMARY KEY REFERENCES booking_quotes(id),authority text UNIQUE NOT NULL, state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','confirmed','review')),reference text UNIQUE,verified_at timestamptz)`);await q.query('ALTER TABLE appointment_slots ADD COLUMN confirmed_quote uuid UNIQUE REFERENCES booking_quotes(id)');}
 async down(q:QueryRunner){await q.query('ALTER TABLE appointment_slots DROP COLUMN confirmed_quote');await q.query('DROP TABLE gateway_payments');}
}
const bank='https://payment.zarinpal.com/pg/v4/payment/';export const startPay='https://www.zarinpal.com/pg/StartPay/';
export function paymentEnabled(){return !!process.env.ZARINPAL_MERCHANT_ID && /^https:\/\/[a-zA-Z0-9.-]+(:\d+)?$/.test(process.env.PUBLIC_ORIGIN||'')}
export async function gateway(action:'request'|'verify',payload:Record<string,unknown>){
 if(!paymentEnabled())throw new ServiceUnavailableException('Gateway not configured');
 try{const r=await fetch(bank+action+'.json',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({merchant_id:process.env.ZARINPAL_MERCHANT_ID,...payload}),redirect:'error',signal:AbortSignal.timeout(8000)});const body=await r.json();if(!r.ok||!body?.data)throw Error();return body.data;}catch{throw new BadGatewayException('Gateway did not confirm the request')}
}
export async function checkout(db:DataSource,client:string,quote:string){
 if(!paymentEnabled())throw new ServiceUnavailableException('Gateway not configured');
 return db.transaction(async m=>{const [q]=await m.query(`SELECT q.* FROM booking_quotes q JOIN appointment_slots s ON s.id=q.slot_id WHERE q.id=$1 AND q.client_id=$2 AND q.expires_at>clock_timestamp() AND s.hold_hash=q.hold_key AND s.held_by=q.client_id AND NOT s.withdrawn AND s.confirmed_quote IS NULL FOR UPDATE OF q,s`,[quote,client]);if(!q)throw new ConflictException('Quote not payable');
 const [prior]=await m.query('SELECT authority,state FROM gateway_payments WHERE quote_id=$1',[quote]);if(prior){if(prior.state!=='pending')throw new ConflictException();return {url:startPay+prior.authority}}
 const data=await gateway('request',{amount:q.amount_irr,currency:'IRR',description:'Rahmani Centre appointment',callback_url:process.env.PUBLIC_ORIGIN+'/api/v1/payments/return'});if(data.code!==100||typeof data.authority!=='string'||!/^A[A-Za-z0-9]{35}$/.test(data.authority))throw new BadGatewayException('Gateway request rejected');
 await m.query('INSERT INTO gateway_payments(quote_id,authority) VALUES($1,$2)',[quote,data.authority]);return {url:startPay+data.authority};});
}
export async function reconcile(db:DataSource,authority:string){
 if(typeof authority!=='string'||!/^A[A-Za-z0-9]{35}$/.test(authority))throw new NotFoundException();
 return db.transaction(async m=>{const [p]=await m.query(`SELECT p.state,q.* FROM gateway_payments p JOIN booking_quotes q ON q.id=p.quote_id WHERE p.authority=$1 FOR UPDATE OF p`,[authority]);if(!p)throw new NotFoundException();if(p.state!=='pending')return p.state;
 const v=await gateway('verify',{amount:p.amount_irr,authority});if(![100,101].includes(v.code)||!/^\d{1,24}$/.test(String(v.ref_id))||String(v.ref_id)==='0')throw new BadGatewayException('Payment not verified');
 const updated=await m.query(`WITH booked AS (UPDATE appointment_slots SET confirmed_quote=$1,hold_until=NULL,hold_hash=NULL,held_by=NULL WHERE id=$2 AND hold_hash=$3 AND held_by=$4 AND NOT withdrawn AND confirmed_quote IS NULL AND hold_until>clock_timestamp() RETURNING id) SELECT id FROM booked`,[p.id,p.slot_id,p.hold_key,p.client_id]);
 const state=updated.length?'confirmed':'review';await m.query('UPDATE gateway_payments SET state=$1,reference=$2,verified_at=now() WHERE authority=$3',[state,String(v.ref_id),authority]);return state;
 });
}
@Controller('api/v1/payments') export class GatewayController {
 constructor(@Inject(DataSource) private db:DataSource){}
 @Get('return') @Header('Cache-Control','no-store') @Redirect('/account/',303) async callback(@Query('Authority') authority:string,@Query('Status') status:string){if(status==='OK')await reconcile(this.db,authority);return {url:'/account/'};}
}
