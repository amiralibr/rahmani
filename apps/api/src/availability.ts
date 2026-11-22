import {branchInfo} from './branches';
import {BadRequestException,Body,ConflictException,Controller,Delete,Get,Header,Inject,NotFoundException,Param,ParseUUIDPipe,Post,Req,UseGuards} from '@nestjs/common';
import {IsOptional,IsUUID,IsIn,IsInt,IsISO8601,Matches,Max,Min} from 'class-validator';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
import {randomUUID} from 'node:crypto';
import {ReceptionGuard} from './reception';

// Single practitioner (the public profile); all services and formats share one calendar.
export class Availability1795046400005 implements MigrationInterface {
 async up(q:QueryRunner){await q.query(`CREATE TABLE appointment_slots(id uuid PRIMARY KEY, service smallint NOT NULL CHECK(service BETWEEN 0 AND 3), mode text NOT NULL CHECK(mode IN ('office','online')),starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),published_by uuid NOT NULL REFERENCES staff_accounts(id),withdrawn boolean NOT NULL DEFAULT false, EXCLUDE USING gist(tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE (NOT withdrawn))`);await q.query('CREATE INDEX slots_start ON appointment_slots(starts_at) WHERE NOT withdrawn');}
 async down(q:QueryRunner){await q.query('DROP TABLE appointment_slots');}
}
class PublishSlot {
 @IsOptional() @IsUUID() branch_id?:string;
 @IsInt() @Min(0) @Max(3) service!:number;
 @IsIn(['office','online']) mode!:string;
 @Matches(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/) @IsISO8601({strict:true}) start!:string;
 @IsIn([30,45,60,90]) minutes!:number;
 @IsInt() @Min(1) @Max(2000000000) fee_irr!:number;
}
@Controller('api/v1/availability') export class AvailabilityController {
 constructor(@Inject(DataSource) private db:DataSource){}
 @Get() @Header('Cache-Control','no-store') list(){return this.db.query(`SELECT id, service, mode, starts_at, ends_at, fee_irr,${branchInfo} FROM appointment_slots WHERE confirmed_quote IS NULL AND NOT withdrawn AND (hold_until IS NULL OR hold_until<=now()) AND starts_at>now() AND starts_at<=now()+interval '90 days' ORDER BY starts_at`);}
 @Post() @UseGuards(ReceptionGuard) async publish(@Body() input:PublishSlot,@Req() req:{staff:{id:string}}){
 if(input.branch_id&&input.mode!=='office')throw new BadRequestException('Online slots have no branch');
 try{const rows=await this.db.query(`INSERT INTO appointment_slots(id,service,mode,starts_at,ends_at,published_by,fee_irr,branch_id) SELECT $1,$2,$3,start,start+$5*interval '1 minute',$6,$7,$8 FROM (SELECT $4::timestamp AT TIME ZONE 'Asia/Tehran' AS start) t WHERE ($8::uuid IS NULL OR EXISTS(SELECT 1 FROM branches WHERE id=$8 AND active FOR SHARE)) AND start>now() AND start<=now()+interval '90 days' RETURNING id`,[randomUUID(),input.service,input.mode,input.start,input.minutes,req.staff.id,input.fee_irr,input.branch_id??null]);if(!rows.length)throw new BadRequestException('Choose a future time within 90 days');return rows[0];}catch(e){if((e as {code?:string}).code==='23P01')throw new ConflictException('Times overlap');throw e;}}
 @Delete(':id') @UseGuards(ReceptionGuard) async withdraw(@Param('id',ParseUUIDPipe) id:string){const rows=await this.db.query('WITH removed AS (UPDATE appointment_slots SET withdrawn=true WHERE id=$1 AND confirmed_quote IS NULL AND NOT withdrawn AND (hold_until IS NULL OR hold_until<=now()) AND starts_at>now() RETURNING id) SELECT id FROM removed',[id]);if(!rows.length)throw new NotFoundException();return rows[0];}
}
