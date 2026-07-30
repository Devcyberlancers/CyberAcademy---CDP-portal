import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsEmail, IsInt, IsOptional, IsString, Matches,
  Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

export class AccessDto {
  @IsBoolean() courses_enabled!: boolean;
  @IsBoolean() assessments_enabled!: boolean;
  @IsBoolean() jobs_enabled!: boolean;
}

export class LessonDto {
  @IsString() title!: string;
  @IsOptional() @IsString() video_url?: string;
  @IsInt() @Min(0) duration_minutes = 0;
  @IsInt() @Min(0) @Max(100) required_completion_percent = 90;
}

export class ModuleDto {
  @IsString() title!: string;
  @IsInt() position = 1;
  @IsArray() @ValidateNested({ each: true }) @Type(() => LessonDto) lessons: LessonDto[] = [];
}

export class CourseDto {
  @IsString() title!: string;
  @IsOptional() @IsString() short_description?: string;
  @IsOptional() @IsString() heading?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category = '';
  @IsOptional() @IsString() instructor = '';
  @IsString() level = 'Beginner';
  @IsOptional() @IsString() duration?: string;
  @IsString() language = 'English';
  @IsOptional() @IsString() banner_url?: string;
  @IsString() visibility = 'public';
  @IsOptional() @IsDateString() start_date?: string;
  @IsOptional() @IsDateString() end_date?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ModuleDto) modules: ModuleDto[] = [];
  @IsOptional() @IsString() status?: string;
  @IsOptional() progress_percent?: number;
  @IsOptional() assessments?: number;
  @IsOptional() labs?: number;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() metadata?: Record<string, any>;
}

export class SnapshotDto {
  payload!: unknown;
  @IsOptional() @IsString() updated_by?: string;
}

export class PortalSettingsDto {
  @IsString() institution_name = 'CDC - Assessment Portal';
  @IsString() allowed_student_domain = '@vitstudent.ac.in';
  @IsString() allowed_admin_domain = '@vit.ac.in';
  @IsBoolean() manual_job_approval_required = true;
}

export class JobCreateDto {
  @IsString() company!: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() job_type?: string;
  @IsOptional() @IsString() ctc?: string;
  @IsOptional() @IsString() eligibility?: string;
  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @IsString() source_url?: string;
  @IsOptional() @IsString() experience?: string;
  @IsOptional() @IsString() salary?: string;
  @IsOptional() @IsString() employment_type?: string;
  @IsOptional() skills?: string[];
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() posted_date?: string;
  @IsOptional() @IsString() apply_url?: string;
  @IsOptional() @IsString() company_logo?: string;
  @IsOptional() @IsString() platform?: string;
  @IsOptional() match_score?: number;
  @IsOptional() @IsBoolean() is_entry_level?: boolean;
}

export class ApplicationDecisionDto {
  @IsOptional() @IsString() review_note?: string;
}

export class StudentMessageDto {
  @IsString() @MinLength(1) @MaxLength(5000) message!: string;
}

export class StudentReminderDto extends StudentMessageDto {
  @Matches(/^\d{2}:\d{2}$/) send_time_ist = '09:00';
}

export class StudentCourseDto {
  @IsInt() @Min(1) course_id!: number;
}

export class StudentAccountDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(3) @MaxLength(40) register_number!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() degree?: string;
  @IsOptional() @IsString() branch?: string;
  @IsOptional() @IsString() batch?: string;
  @IsString() @MinLength(3) @MaxLength(80) username!: string;
  @IsString() @MinLength(8) @MaxLength(120) temp_password!: string;
  @IsString() @MinLength(5) @MaxLength(500) portal_link!: string;
  @IsEmail() credential_email!: string;
  @IsOptional() @IsString() sender_email?: string;
  @IsOptional() @IsString() company_email?: string;
  @IsOptional() @IsBoolean() send_credentials = true;
}

export class CredentialSendDto {
  @IsEmail() recipient_email!: string;
  @IsEmail() login_email!: string;
  @IsString() @MinLength(2) @MaxLength(120) student_name!: string;
  @IsString() @MinLength(5) @MaxLength(500) portal_link!: string;
  @IsEmail() company_email!: string;
  @IsOptional() @IsString() sender_email?: string;
  @IsString() @MinLength(8) @MaxLength(120) temp_password!: string;
}

export class LegacyStudentLoginDto {
  @IsEmail() email!: string;
  @IsOptional() @IsString() full_name = '';
  @IsOptional() @IsString() username = '';
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsString() cyberlancers_id = '';
  @IsOptional() @IsString() registration_number = '';
  @IsOptional() @IsString() batch = '';
  @IsOptional() @IsString() course = '';
  @IsOptional() @IsString() college = '';
  @IsOptional() @IsString() department = 'Cyber Security';
  @IsOptional() cgpa = 0;
  @IsOptional() @IsString() skills = '';
  @IsOptional() @IsBoolean() send_email = true;
}
