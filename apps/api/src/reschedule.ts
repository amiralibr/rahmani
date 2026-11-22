import {ConflictException} from '@nestjs/common';
import {IsUUID} from 'class-validator';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
export class Moves1795046400014 implements MigrationInterface{
 async up(q:QueryRunner){await q.query(`CREATE TABLE session_moves(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,quote_id uuid NOT NULL REFERENCES booking_quotes(id),from_slot uuid NOT NULL REFERENCES appointment_slots(id),to_slot uuid NOT NULL REFERENCES appointment_slots(id),actor uuid NOT NULL REFERENCES staff_accounts(id),at timestamptz NOT NULL DEFAULT now(),CHECK(from_slot<>to_slot))`);await q.query('CREATE INDEX session_moves_quote ON session_moves(quote_id,id DESC)');}
 async down(q:QueryRunner){await q.query('DROP TABLE session_moves');}
}
export class MoveInput{@IsUUID() target!:string;@IsUUID() quote!:string;}
// Preserve all paid terms. Expired holds may be replaced; active ones never are.
const match=`a.starts_at>clock_timestamp() AND NOT EXISTS(SELECT 1 FROM cancellation_requests r WHERE r.quote_id=a.confirmed_quote AND r.decision IS NULL) AND a.confirmed_quote IS NOT NULL AND b.confirmed_quote IS NULL AND NOT b.withdrawn AND b.starts_at>clock_timestamp() AND (b.hold_until IS NULL OR b.hold_until<=clock_timestamp()) AND b.service=a.service AND b.mode=a.mode AND b.branch_id IS NOT DISTINCT FROM a.branch_id AND b.fee_irr=q.amount_irr AND b.ends_at-b.starts_at=a.ends_at-a.starts_at`;
export function alternatives(db:DataSource,id:string){return db.query(`SELECT b.id,b.starts_at,b.ends_at FROM appointment_slots a JOIN booking_quotes q ON q.id=a.confirmed_quote JOIN appointment_slots b ON b.id<>a.id WHERE a.id=$1 AND ${match} ORDER BY b.starts_at`,[id]);}
export function reschedule(db:DataSource,from:string,input:MoveInput,actor:string){return db.transaction(async m=>{
 await m.query('SELECT id FROM appointment_slots WHERE id IN ($1,$2) ORDER BY id FOR UPDATE',[from,input.target]);
 const eligible=await m.query(`SELECT a.id FROM appointment_slots a JOIN booking_quotes q ON q.id=a.confirmed_quote JOIN appointment_slots b ON b.id=$2 WHERE a.id=$1 AND q.id=$3 AND ${match}`,[from,input.target,input.quote]);if(!eligible.length)throw new ConflictException('Session or replacement no longer eligible');
 await m.query('UPDATE appointment_slots SET confirmed_quote=NULL WHERE id=$1',[from]);await m.query('UPDATE appointment_slots SET confirmed_quote=$1,held_by=NULL,hold_hash=NULL,hold_until=NULL WHERE id=$2',[input.quote,input.target]);await m.query('INSERT INTO session_moves(quote_id,from_slot,to_slot,actor) VALUES($1,$2,$3,$4)',[input.quote,from,input.target,actor]);return {ok:true};});}
