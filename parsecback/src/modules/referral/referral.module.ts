import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReferralService } from './referral.service';
import { ReferralController } from './referral.controller';
import { Referral } from './entities/referral.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Referral, User]), AuthModule],
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService, TypeOrmModule],
})
export class ReferralModule {}
