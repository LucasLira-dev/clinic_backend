import { IsEmail, IsString, IsArray, IsOptional, MinLength } from 'class-validator';

export class CreateDoctorDto {
  @IsString()
  @MinLength(3)
  nome: string;

  @IsString()
  crm: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  biografia?: string;

  @IsString()
  @IsOptional()
  profilePhoto?: string;

  @IsArray()
  @IsString({ each: true })
  especialidades: string[]; // Array de nomes de especialidades

  @IsArray()
  @IsString({ each: true })
  diasAtendimento: string[]; // Array de dias: ["SEGUNDA", "QUARTA"]
}
