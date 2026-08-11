import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ApplicationStatusDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsIn(['applied', 'not_applied', 'pending'])
  @Transform(({ value }) => String(value).trim().toLowerCase())
  status!: string;
}

export class StudentProfileDto {
  @IsEmail()
  email!: string;

  @IsString() @IsOptional() full_name = '';
  @IsString() @IsOptional() first_name = '';
  @IsString() @IsOptional() cyberlancers_id = '';
  @IsString() @IsOptional() registration_number = '';
  @IsString() @IsOptional() phone = '';
  @IsString() @IsOptional() gender = '';
  @IsString() @IsOptional() date_of_birth = '';
  @IsString() @IsOptional() tag = '';
  @IsString() @IsOptional() batch = '';
  @IsString() @IsOptional() course = '';
  @IsString() @IsOptional() college = '';
  @IsString() @IsOptional() department = '';
  @IsString() @IsOptional() status = '';
  @IsString() @IsOptional() resume_url = '';
  @IsString() @IsOptional() resume_file_name = '';
  @IsString() @IsOptional() resume_data_url?: string;
  @IsString() @IsOptional() portfolio_url = '';
  @IsString() @IsOptional() education_json = '';
  @IsString() @IsOptional() mentor_name = '';
  @IsString() @IsOptional() photo_data_url?: string;
}

export class ModuleVideoCompletionDto {
  @Transform(({ value }) => Number(value))
  module_index!: number;
}

export class ModuleQuizSubmissionDto {
  @Transform(({ value }) => Number(value))
  module_index!: number;
  answers!: Record<string, string>;

  @IsOptional()
  @IsString()
  started_at?: string;

  @IsOptional()
  @Transform(({ value }) => Math.max(0, Number(value) || 0))
  tab_switches = 0;

  @IsOptional()
  @IsString()
  browser?: string;

  @IsOptional()
  @IsString()
  operating_system?: string;

  @IsOptional()
  @IsString()
  violation_reason?: string;
}

export class JobQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  limit = 500;
}

export class JobSearchQueryDto extends JobQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  q!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  location?: string;
}

export class StudentLegacyLoginDto {
  @IsString() username!: string;
  @IsString() password!: string;
}

export class StudentProfileCompleteDto {
  @IsString() @MinLength(2) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(5) phone!: string;
  @IsString() @MinLength(2) degree!: string;
  @IsString() @MinLength(2) branch!: string;
  @IsString() @MinLength(2) batch!: string;
}

export class StudentSubmissionDto {
  submission!: Record<string, any>;
}
