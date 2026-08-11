import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  full_name = '';

  @IsString()
  cyberlancers_id = '';
}

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  otp: string;
}

export class EmailDto {
  @IsEmail()
  email: string;
}

export class PasswordResetConfirmDto {
  @IsEmail()
  email: string;

  @IsString()
  token: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{12,128}$/, {
    message: 'Password must be strong: use 12 or more characters with uppercase, lowercase, number, and special character',
  })
  new_password: string;
}

export class MailCodeDto {
  @IsEmail()
  email: string;

  @IsString()
  code: string;
}

export class AdminRegisterDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(120) password!: string;
}

export class AdminResetConfirmDto {
  @IsString() @MinLength(20) @MaxLength(200) token!: string;
  @IsString() @MinLength(8) @MaxLength(120) password!: string;
}
