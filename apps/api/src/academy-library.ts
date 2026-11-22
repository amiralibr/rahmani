import {NotFoundException} from '@nestjs/common';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';
const courses=new Set(['mindfulness','dialogue','parenting']);
export class Library1795046400023 implements MigrationInterface {
 async up(q:QueryRunner){await q.query(`CREATE TABLE saved_courses(client_id uuid REFERENCES client_accounts(id) ON DELETE CASCADE, course text NOT NULL, saved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(client_id,course))`)}
 async down(q:QueryRunner){await q.query('DROP TABLE saved_courses')}
}
export async function savedCourses(db:DataSource,id:string):Promise<string[]>{const rows=await db.query('SELECT course FROM saved_courses WHERE client_id=$1 ORDER BY saved_at DESC,course',[id]);return rows.map((r:{course:string})=>r.course)}
export async function updateLibrary(db:DataSource,id:string,course:string,save:boolean){if(!courses.has(course))throw new NotFoundException();await db.query(save?'INSERT INTO saved_courses(client_id,course) VALUES($1,$2) ON CONFLICT DO NOTHING':'DELETE FROM saved_courses WHERE client_id=$1 AND course=$2',[id,course]);return {saved:save}}
