import {
  IsEmail,
  IsString,
  IsArray,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateDoctorDto {
  @IsString()
  @MinLength(3)
  nome: string;

  @IsString()
  crm: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  senha: string;

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

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:MM format' })
  startTime: string; // Horário de início, ex: "08:00"

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:MM format' })
  endTime: string; // Horário de término, ex: "17:00"
}
