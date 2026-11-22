import {Body,Controller,Delete,Get,Header,Inject,NotFoundException,Param,ParseUUIDPipe,Post,UseGuards} from '@nestjs/common';
import {Length,Matches} from 'class-validator';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
import {randomUUID} from 'node:crypto';
import {ReceptionGuard} from './reception';
export class Branches1795046400011 implements MigrationInterface {
 async up(q:QueryRunner){await q.query(`CREATE TABLE branches(id uuid PRIMARY KEY,name_fa varchar(90) NOT NULL,name_en varchar(90) NOT NULL,address_fa varchar(240) NOT NULL,address_en varchar(240) NOT NULL,active boolean NOT NULL DEFAULT true)`);await q.query("ALTER TABLE appointment_slots ADD COLUMN branch_id uuid REFERENCES branches(id), ADD CHECK(branch_id IS NULL OR mode='office')");}
 async down(q:QueryRunner){await q.query('ALTER TABLE appointment_slots DROP COLUMN branch_id');await q.query('DROP TABLE branches');}
}
class NewBranch {
 @Length(1,90) @Matches(/\S/) name_fa!:string; @Length(1,90) @Matches(/\S/) name_en!:string;
 @Length(1,240) @Matches(/\S/) address_fa!:string; @Length(1,240) @Matches(/\S/) address_en!:string;
}
@Controller('api/v1/branches') export class BranchController {
 constructor(@Inject(DataSource) private db:DataSource){}
 @Get() @Header('Cache-Control','no-store') list(){return this.db.query('SELECT id,name_fa,name_en,address_fa,address_en FROM branches WHERE active ORDER BY name_fa,id');}
 @Post() @UseGuards(ReceptionGuard) async create(@Body() b:NewBranch){const [row]=await this.db.query('INSERT INTO branches(id,name_fa,name_en,address_fa,address_en) VALUES($1,$2,$3,$4,$5) RETURNING id',[randomUUID(),b.name_fa.trim(),b.name_en.trim(),b.address_fa.trim(),b.address_en.trim()]);return row;}
 @Delete(':id') @UseGuards(ReceptionGuard) async archive(@Param('id',ParseUUIDPipe) id:string){const rows=await this.db.query('WITH u AS (UPDATE branches SET active=false WHERE id=$1 AND active RETURNING id) SELECT id FROM u',[id]);if(!rows.length)throw new NotFoundException();return rows[0];}
}
// Archive hides the directory entry, but previously published sessions keep their address.
export const branchInfo=`(SELECT json_build_object('name_fa',b.name_fa,'name_en',b.name_en,'address_fa',b.address_fa,'address_en',b.address_en) FROM branches b WHERE b.id=appointment_slots.branch_id) AS branch`;
