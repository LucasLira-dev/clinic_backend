import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class UpdateDoctorPhotoDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  profilePhoto: string;
}
