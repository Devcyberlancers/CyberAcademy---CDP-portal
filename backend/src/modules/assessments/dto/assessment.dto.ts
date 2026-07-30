import { IsBoolean, IsEmail, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AssessmentCollectionDto {
  assessments!: Record<string, any>[];
}

export class DeviceDto {
  @IsString() @IsOptional() browser = '';
  @IsString() @IsOptional() operating_system = '';
  @IsString() @IsOptional() screen_resolution = '';
  @IsString() @IsOptional() user_agent = '';
}

export class StartAttemptDto {
  @IsEmail() email!: string;
  @IsOptional() @ValidateNested() @Type(() => DeviceDto) device = new DeviceDto();
}

export class SaveAnswerDto {
  @IsString() question_id!: string;
  @IsString() option_id!: string;
  @IsOptional() @IsString() client_timestamp?: string;
}

export class EventDto {
  @IsString() event_type!: string;
  @IsString() @IsOptional() reason = '';
  @IsObject() @IsOptional() details: Record<string, any> = {};
}

export class CloseAttemptDto {
  @IsString() @IsOptional() reason = 'STUDENT_SUBMIT';
  @IsObject() @IsOptional() answers: Record<string, string> = {};
  @IsBoolean() @IsOptional() auto_submitted = false;
}

export class NativeAssessmentDto {
  @IsString() assignment_id!: string;
  @IsString() assignment_title!: string;
  duration_minutes = 30;
  published = true;
  active = true;
  available_from?: string;
  available_until?: string;
  resume_allowed = true;
  max_attempts = 1;
  enabled = true;
  require_fullscreen = true;
  end_on_fullscreen_exit = true;
  end_on_tab_switch = true;
  end_on_blur = true;
  randomize_question_order = true;
  randomize_option_order = true;
  auto_save_answers = true;
  auto_submit_on_timer_end = true;
  violation_policy = 'end_exam';
  questions: Record<string, any>[] = [];
}
