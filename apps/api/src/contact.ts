import {Exams1795046400026} from './exams';
import {TuitionController,Tuition1795046400025,TuitionReviewsController,TuitionReviews1795046400027} from './tuition';
import {SpecialistController,ManagerController} from './panels';
import {SiteSettingsController,SiteSettings1795046400031} from './site-settings';
import {FeedbackController,FeedbackQueueController,Feedback1795046400032} from './feedback';
import {ReceptionCashController,Cash1795046400033} from './cash';
import {ClinicalController,Clinical1795046400034} from './clinical';
import {JournalController,Journal1795046400029} from './journal';
import {Meeting1795046400030} from './meeting';
import {AcademyController,Cohorts1795046400024} from './cohorts';
import {Library1795046400023} from './academy-library';
import {InquiryReplies1795046400022,Mismatch1795046400021} from './mismatch';
import {RefundReceipt1795046400020,RefundAuthority1795046400019,FinanceOutcome1795046400018,FinanceReview1795046400017} from './finance-review';
import {Decisions1795046400016,Cancellation1795046400015} from './cancellation';
import {Moves1795046400014} from './reschedule';
import {AttendanceController,Attendance1795046400013} from './attendance';
import {Payments1795046400012,GatewayController} from './payments';
import {BranchController,Branches1795046400011} from './branches';
import {ClientRecovery1795046400010} from './client-recovery';
import {Quotes1795046400009} from './quotes';
import {SlotFees1795046400008} from './slot-fees';
import {ClientController,ClientOriginGuard,Clients1795046400007} from './clients';
import {HoldsController,Holds1795046400006} from './holds';
import {AvailabilityController,Availability1795046400005} from './availability';
import { StaffMfa1795046400004 } from './mfa';
import { StaffController,Staff1795046400003,StaffRoles1795046400028 } from './staff';
import { ContactHistory1795046400002 } from './contact-history';
import { ReceptionController, ReceptionGuard, ReceptionSchema1795046400001 } from './reception';
import { Body, Controller, Module, Post, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Equals, IsEmail, IsIn, MaxLength } from 'class-validator';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';

class ContactSchema1795046400000 implements MigrationInterface {
  async up(q: QueryRunner) { await q.query(`CREATE TABLE contact_requests (
    id uuid PRIMARY KEY, email varchar(254) NOT NULL,
    topic text NOT NULL CHECK(topic IN ('counselling','academy','general')),
    locale text NOT NULL CHECK(locale IN ('fa','en')),
    created_at timestamptz NOT NULL DEFAULT now(), consent_version text NOT NULL)`); }
  async down(q: QueryRunner) { await q.query('DROP TABLE contact_requests'); }
}
class ContactInput {
  @IsEmail() @MaxLength(254) email!: string;
  @IsIn(['academy','counselling','general']) topic!: string;
  @IsIn(['fa','en']) locale!: string;
  @Equals(true) consent!: boolean;
}
@Controller('api/v1/contact-requests')
class ContactController {
  constructor(@Inject(DataSource) private db: DataSource) {}
  @Post() async create(@Body() body: ContactInput) {
    const id=randomUUID();
    try { await this.db.query('INSERT INTO contact_requests(id,email,topic,locale,consent_version) VALUES($1,$2,$3,$4,$5)',[id,body.email.trim(),body.topic,body.locale,'contact-v1']); }
    catch { throw new ServiceUnavailableException('Could not save request'); }
    return {reference:id};
  }
}
@Module({controllers:[ClinicalController,ReceptionCashController,FeedbackController,FeedbackQueueController,SiteSettingsController,JournalController,SpecialistController,ManagerController,TuitionReviewsController,TuitionController,AcademyController,ContactController,ReceptionController,StaffController,AvailabilityController,HoldsController,ClientController,BranchController,GatewayController,AttendanceController],providers:[ClientOriginGuard,ReceptionGuard,{provide:DataSource,useFactory:async()=>{
  if(!process.env.PGPASSWORD) throw new Error('PGPASSWORD must be configured');
  return new DataSource({type:'postgres',host:process.env.PGHOST||'localhost',port:Number(process.env.PGPORT||5432),database:process.env.PGDATABASE||'rahmani',username:process.env.PGUSER||'rahmani',password:process.env.PGPASSWORD,synchronize:false,migrations:[ContactSchema1795046400000,ReceptionSchema1795046400001,ContactHistory1795046400002,Staff1795046400003,StaffMfa1795046400004,Availability1795046400005,Holds1795046400006,Clients1795046400007,SlotFees1795046400008,Quotes1795046400009,ClientRecovery1795046400010,Branches1795046400011,Payments1795046400012,Attendance1795046400013,Moves1795046400014,Cancellation1795046400015,Decisions1795046400016,FinanceReview1795046400017,FinanceOutcome1795046400018,RefundAuthority1795046400019,RefundReceipt1795046400020,Mismatch1795046400021,InquiryReplies1795046400022,Library1795046400023,Cohorts1795046400024,Tuition1795046400025,Exams1795046400026,TuitionReviews1795046400027,StaffRoles1795046400028,Journal1795046400029,Meeting1795046400030,SiteSettings1795046400031,Feedback1795046400032,Cash1795046400033,Clinical1795046400034],migrationsRun:true}).initialize();
}}]}) export class ContactModule {}
