import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInjuryLocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  bodyRegion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  side?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
