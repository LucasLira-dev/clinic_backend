import { IsString } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  doctorId: string;

  @IsString()
  date: string;

  @IsString()
  time: string;
}
