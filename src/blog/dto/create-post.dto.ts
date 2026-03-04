import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePostDto {
  @IsString({ message: 'Title must be a string' })
  @MinLength(5, { message: 'Title must be at least 5 characters long' })
  @MaxLength(100, { message: 'Title must be at most 100 characters long' })
  title: string;

  @IsString({ message: 'Content must be a string' })
  @MinLength(20, { message: 'Content must be at least 20 characters long' })
  @MaxLength(5000, { message: 'Content must be at most 5000 characters long' })
  content: string;

  @IsString({ message: 'Description must be a string' })
  @MinLength(10, { message: 'Description must be at least 10 characters long' })
  @MaxLength(300, {
    message: 'Description must be at most 300 characters long',
  })
  description: string;

  @IsString({ message: 'Tag must be a string' })
  @MinLength(3, { message: 'Tag must be at least 3 characters long' })
  @MaxLength(80, { message: 'Tag must be at most 80 characters long' })
  tag: string;
}
