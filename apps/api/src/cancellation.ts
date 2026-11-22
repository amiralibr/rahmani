import {ConflictException} from '@nestjs/common';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';

export class Cancellation1795046400015 implements MigrationInterface {
 async up(q:QueryRunner){await q.query(`CREATE TABLE cancellation_requests (
 quote_id uuid PRIMARY KEY REFERENCES booking_quotes(id), requested_slot uuid NOT NULL REFERENCES appointment_slots(id),
 requested_at timestamptz NOT NULL DEFAULT now(), reviewer uuid REFERENCES staff_accounts(id), seen_at timestamptz,
 CHECK ((reviewer IS NULL) = (seen_at IS NULL)))`)}
 async down(q:QueryRunner){await q.query('DROP TABLE cancellation_requests')}
}
// A request is not a cancellation or a refund. The paid booking stays intact.
export async function requestCancellation(db:DataSource,client:string,quote:string){
 return db.transaction(async m=>{const [slot]=await m.query(`SELECT s.id FROM appointment_slots s JOIN booking_quotes q ON q.id=s.confirmed_quote WHERE q.id=$1 AND q.client_id=$2 AND s.starts_at>clock_timestamp() FOR UPDATE OF s`,[quote,client]);
 if(!slot)throw new ConflictException();await m.query('INSERT INTO cancellation_requests(quote_id,requested_slot) VALUES($1,$2) ON CONFLICT DO NOTHING',[quote,slot.id]);return {ok:true}});
}
export async function acknowledgeCancellation(db:DataSource,quote:string,staff:string){const rows=await db.query(`WITH changed AS (UPDATE cancellation_requests SET reviewer=$2,seen_at=now() WHERE quote_id=$1 AND reviewer IS NULL RETURNING quote_id) SELECT quote_id FROM changed`,[quote,staff]);if(!rows.length)throw new ConflictException();return {ok:true};}

export class Decisions1795046400016 implements MigrationInterface {
 async up(q:QueryRunner){await q.query(`ALTER TABLE cancellation_requests ADD decision text CHECK(decision IN ('approved','declined')), ADD decided_by uuid REFERENCES staff_accounts(id), ADD decided_at timestamptz, ADD CHECK ((decision IS NULL)=(decided_at IS NULL) AND (decision IS NULL)=(decided_by IS NULL))`)}
 async down(q:QueryRunner){await q.query('ALTER TABLE cancellation_requests DROP decision,DROP decided_by,DROP decided_at')}
}
export function decideCancellation(db:DataSource,slot:string,quote:string,decision:'approved'|'declined',staff:string){return db.transaction(async m=>{
 const [s]=await m.query('SELECT id FROM appointment_slots WHERE id=$1 AND confirmed_quote=$2 FOR UPDATE',[slot,quote]);if(!s)throw new ConflictException();
 const changed=await m.query(`WITH u AS (UPDATE cancellation_requests SET decision=$3,decided_by=$4,decided_at=now() WHERE quote_id=$1 AND reviewer IS NOT NULL AND decision IS NULL AND ($3='declined' OR (requested_slot=$2 AND EXISTS(SELECT 1 FROM appointment_slots WHERE id=$2 AND starts_at>clock_timestamp()))) RETURNING quote_id) SELECT * FROM u`,[quote,slot,decision,staff]);if(!changed.length)throw new ConflictException();
 if(decision==='approved')await m.query('UPDATE appointment_slots SET confirmed_quote=NULL WHERE id=$1',[slot]);return {ok:true};
});}
export function cancellationResults(db:DataSource,client:string){return db.query(`SELECT (SELECT reference FROM refund_receipts f WHERE f.quote_id=r.quote_id) AS refund_reference,(SELECT refund_decision FROM cancellation_reviews f WHERE f.quote_id=r.quote_id) AS refund_decision,(SELECT proposed_irr FROM cancellation_reviews f WHERE f.quote_id=r.quote_id) AS proposed_irr, EXISTS(SELECT 1 FROM cancellation_reviews f WHERE f.quote_id=r.quote_id) AS finance_started,r.quote_id,r.decision,r.decided_at,s.starts_at FROM cancellation_requests r JOIN booking_quotes q ON q.id=r.quote_id JOIN appointment_slots s ON s.id=r.requested_slot WHERE q.client_id=$1 AND decision IS NOT NULL ORDER BY decided_at DESC LIMIT 20`,[client])}
