import {ConflictException,NotFoundException} from '@nestjs/common';
import {randomBytes} from 'node:crypto';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
export class Meeting1795046400030 implements MigrationInterface{
 async up(q:QueryRunner){await q.query('ALTER TABLE booking_quotes ADD meeting_room text UNIQUE')}
 async down(q:QueryRunner){await q.query('ALTER TABLE booking_quotes DROP meeting_room')}
}
// Creates-or-returns an unguessable Jitsi room for a confirmed online appointment owned by the client.
// Access control is possession of the link plus the client session; no recording or server-side media.
export async function meetingRoom(db:DataSource,quote:string,client:string){return db.transaction(async m=>{
 const [q]=await m.query(`SELECT q.id,q.meeting_room FROM booking_quotes q JOIN appointment_slots s ON s.id=q.slot_id WHERE q.id=$1 AND q.client_id=$2 AND s.mode='online' AND q.expires_at>now() AND s.ends_at>now()-interval '15 minutes' FOR UPDATE`,[quote,client]);
 if(!q)throw new NotFoundException();if(q.meeting_room)return {url:'https://meet.jit.si/'+q.meeting_room};
 const room='rahmani-'+randomBytes(16).toString('hex');await m.query('UPDATE booking_quotes SET meeting_room=$2 WHERE id=$1 AND meeting_room IS NULL',[quote,room]);
 const [saved]=await m.query('SELECT meeting_room FROM booking_quotes WHERE id=$1',[quote]);if(!saved?.meeting_room)throw new ConflictException();return {url:'https://meet.jit.si/'+saved.meeting_room};})}
