import { IsString } from 'class-validator';

export class CreateAppointmentDto {
  @IsString({ message: 'Doctor ID must be a string' })
  doctorId: string;

  @IsString({ message: 'Patient ID must be a string' })
  patientId: string;

  @IsString({ message: 'Date must be a string' })
  date: string;

  @IsString({ message: 'Time must be a string' })
  time: string;
}
