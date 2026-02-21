import { IsOptional, IsString } from 'class-validator';

export class GetAvailabilityDto {
  @IsOptional()
  @IsString()
  specialtyId?: string;
}
