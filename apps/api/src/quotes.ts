import {ConflictException,NotFoundException} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';

export class Quotes1795046400009 implements MigrationInterface {
 async up(q:QueryRunner){await q.query(`CREATE TABLE booking_quotes (
   id uuid PRIMARY KEY, client_id uuid NOT NULL REFERENCES client_accounts(id),
   slot_id uuid NOT NULL REFERENCES appointment_slots(id), hold_key text NOT NULL UNIQUE,
   amount_irr integer NOT NULL CHECK(amount_irr>0), issued_at timestamptz NOT NULL DEFAULT now(),
   expires_at timestamptz NOT NULL)`);
   await q.query('CREATE INDEX client_quote_order ON booking_quotes(client_id,issued_at DESC)');}
 async down(q:QueryRunner){await q.query('DROP TABLE booking_quotes');}
}
/** A quote is not a charge, payment receipt or confirmed appointment. */
export async function issueQuote(db:DataSource,client:string,slot:string){
 return db.transaction(async m=>{
   const [s]=await m.query(`SELECT hold_hash,fee_irr,hold_until FROM appointment_slots WHERE id=$1 AND held_by=$2 AND NOT withdrawn AND hold_until>clock_timestamp() FOR UPDATE`,[slot,client]);
   if(!s)throw new NotFoundException('Active hold not found');
   if(s.fee_irr===null)throw new ConflictException('Fee not set');
   const [row]=await m.query(`INSERT INTO booking_quotes(id,client_id,slot_id,hold_key,amount_irr,expires_at) SELECT $1,$2,$3,$4,$5,$6::timestamptz WHERE $6::timestamptz>clock_timestamp() ON CONFLICT(hold_key) DO UPDATE SET hold_key=EXCLUDED.hold_key RETURNING id,amount_irr,expires_at`,[randomUUID(),client,slot,s.hold_hash,s.fee_irr,s.hold_until]);
   if(!row)throw new ConflictException('Hold expired');return row;
 });
}
export function recentQuotes(db:DataSource,client:string){return db.query(`SELECT p.state AS payment_state,p.reference,p.verified_at,q.id,q.slot_id,q.amount_irr,q.issued_at,q.expires_at,s.service,s.mode,s.starts_at,
 CASE WHEN q.expires_at<=now() THEN 'expired' WHEN s.hold_hash IS DISTINCT FROM q.hold_key OR s.held_by IS DISTINCT FROM q.client_id OR s.withdrawn THEN 'inactive' ELSE 'active' END AS state
 FROM booking_quotes q LEFT JOIN gateway_payments p ON p.quote_id=q.id JOIN appointment_slots s ON s.id=q.slot_id WHERE q.client_id=$1 ORDER BY q.issued_at DESC,q.id DESC LIMIT 20`,[client]);}
