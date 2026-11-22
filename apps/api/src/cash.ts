import {BadRequestException,Body,Controller,Get,Header,Inject,NotFoundException,ConflictException,Post,Req,UseGuards} from '@nestjs/common';
import {IsInt,IsUUID,Max,Min} from 'class-validator';
import {randomBytes} from 'node:crypto';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
import {ReceptionGuard} from './reception';
export class Cash1795046400033 implements MigrationInterface{
 async up(q:QueryRunner){await q.query(`CREATE TABLE cash_receipts(quote_id uuid PRIMARY KEY REFERENCES booking_quotes(id),reference text UNIQUE NOT NULL CHECK(reference ~ '^[A-Z0-9-]{4,32}$'),amount_irr integer NOT NULL CHECK(amount_irr>0),discount_irr integer NOT NULL DEFAULT 0 CHECK(discount_irr>=0),recorded_by uuid NOT NULL REFERENCES staff_accounts(id),recorded_at timestamptz NOT NULL DEFAULT now())`)}
 async down(q:QueryRunner){await q.query('DROP TABLE cash_receipts')}
}
class RecordCash{@IsUUID() quote_id!:string; @IsInt() @Min(0) @Max(1000000000) discount_irr=0}
@Controller('api/v1/reception/cash') @UseGuards(ReceptionGuard) export class ReceptionCashController{constructor(@Inject(DataSource) private db:DataSource){}
 @Get('pending') @Header('Cache-Control','no-store') pending(){return this.db.query(`SELECT s.id AS slot_id,q.id AS quote_id,s.service,s.starts_at,q.amount_irr,c.username FROM appointment_slots s JOIN booking_quotes q ON s.id=q.slot_id AND s.hold_hash=q.hold_key JOIN client_accounts c ON c.id=q.client_id WHERE s.mode='office' AND NOT s.withdrawn AND s.confirmed_quote IS NULL AND s.hold_hash IS NOT NULL AND s.starts_at>now()-interval '1 day' ORDER BY s.starts_at LIMIT 50`)}
 @Post('record') @Header('Cache-Control','no-store') async record(@Body() b:RecordCash,@Req() req:{staff:{id:string}}){
  if(!Number.isInteger(b.discount_irr))throw new BadRequestException();
  return this.db.transaction(async m=>{
   const [q]=await m.query(`SELECT q.id,q.amount_irr,q.hold_key,q.client_id,s.id AS slot_id,s.mode,s.withdrawn,s.confirmed_quote,s.hold_hash,s.held_by FROM booking_quotes q JOIN appointment_slots s ON s.id=q.slot_id WHERE q.id=$1 FOR UPDATE OF q,s`,[b.quote_id]);
   if(!q)throw new NotFoundException('Quote not found');
   if(q.mode!=='office')throw new ConflictException('Only office bookings can be settled in cash');
   if(q.withdrawn||q.confirmed_quote)throw new ConflictException('Slot already settled or withdrawn');
   if(!q.hold_hash||q.hold_hash!==q.hold_key||q.held_by!==q.client_id)throw new ConflictException('Hold no longer valid');
   if(b.discount_irr>=q.amount_irr)throw new BadRequestException('Discount cannot cover the full amount');
   const reference='CASH-'+randomBytes(6).toString('hex').toUpperCase();
   const [receipt]=await m.query('INSERT INTO cash_receipts(quote_id,reference,amount_irr,discount_irr,recorded_by) VALUES($1,$2,$3,$4,$5) RETURNING reference',[q.id,reference,q.amount_irr-b.discount_irr,b.discount_irr,req.staff.id]);
   const updated=await m.query(`WITH booked AS (UPDATE appointment_slots SET confirmed_quote=$1,hold_until=NULL,hold_hash=NULL,held_by=NULL WHERE id=$2 AND hold_hash=$3 AND held_by=$4 AND NOT withdrawn AND confirmed_quote IS NULL RETURNING id) SELECT id FROM booked`,[q.id,q.slot_id,q.hold_key,q.client_id]);
   if(!updated.length)throw new ConflictException('Slot could not be confirmed');
   return {reference:receipt.reference,amount_irr:q.amount_irr-b.discount_irr,discount_irr:b.discount_irr};
  });
 }
 @Get('report') @Header('Cache-Control','no-store') async report(){const [[month],recent]=await Promise.all([
   this.db.query(`SELECT count(*)::int AS n,coalesce(sum(amount_irr),0)::bigint AS total_irr,coalesce(sum(discount_irr),0)::bigint AS discount_irr FROM cash_receipts WHERE recorded_at>date_trunc('month',now())`),
   this.db.query(`SELECT r.reference,r.amount_irr,r.discount_irr,r.recorded_at,s.service,s.starts_at,a.username FROM cash_receipts r JOIN booking_quotes q ON q.id=r.quote_id JOIN appointment_slots s ON s.id=q.slot_id JOIN staff_accounts a ON a.id=r.recorded_by ORDER BY r.recorded_at DESC LIMIT 10`)]);
  return {month,recent};}
}
