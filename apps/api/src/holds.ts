import {branchInfo} from './branches';
import {ConflictException,Controller,Delete,Get,Header,Headers,Inject,NotFoundException,Param,ParseUUIDPipe,Post} from '@nestjs/common';
import {createHash,randomBytes} from 'node:crypto';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
export class Holds1795046400006 implements MigrationInterface {
 async up(q:QueryRunner){await q.query('ALTER TABLE appointment_slots ADD COLUMN hold_hash text, ADD COLUMN hold_until timestamptz, ADD CHECK((hold_hash IS NULL)=(hold_until IS NULL))');await q.query('CREATE UNIQUE INDEX slot_hold_hash ON appointment_slots(hold_hash) WHERE hold_hash IS NOT NULL');}
 async down(q:QueryRunner){await q.query('ALTER TABLE appointment_slots DROP COLUMN hold_hash,DROP COLUMN hold_until');}
}
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
function owner(header?:string){if(!header||!/^Bearer [a-f0-9]{64}$/.test(header))throw new NotFoundException();return hash(header.slice(7));}
@Controller('api/v1/holds') export class HoldsController {
 private readonly minutes=Number(process.env.HOLD_MINUTES??10);
 constructor(@Inject(DataSource) private db:DataSource){if(!Number.isInteger(this.minutes)||this.minutes<1||this.minutes>30)throw Error('HOLD_MINUTES must be 1..30');}
 @Post(':slot') @Header('Cache-Control','no-store') async create(@Param('slot',ParseUUIDPipe) slot:string){
 const token=randomBytes(32).toString('hex');const [row]=await this.db.query(`WITH claimed AS (UPDATE appointment_slots SET held_by=NULL,hold_hash=$2,hold_until=least(starts_at,now()+$3 * interval '1 minute') WHERE id=$1 AND confirmed_quote IS NULL AND NOT withdrawn AND starts_at>now() AND (hold_until IS NULL OR hold_until<=now()) RETURNING id,service,mode,starts_at,ends_at,fee_irr,hold_until,${branchInfo}) SELECT * FROM claimed`,[slot,hash(token),this.minutes]);if(!row)throw new ConflictException('Slot no longer available');return {...row,token};}
 @Get() @Header('Cache-Control','no-store') async current(@Headers('authorization') header?:string){const [row]=await this.db.query(`SELECT id,service,mode,starts_at,ends_at,fee_irr,hold_until,${branchInfo} FROM appointment_slots WHERE held_by IS NULL AND hold_hash=$1 AND hold_until>now() AND NOT withdrawn`,[owner(header)]);if(!row)throw new NotFoundException();return row;}
 @Delete() @Header('Cache-Control','no-store') async release(@Headers('authorization') header?:string){await this.db.query('UPDATE appointment_slots SET hold_hash=NULL,hold_until=NULL WHERE held_by IS NULL AND hold_hash=$1',[owner(header)]);return {released:true};}
}
