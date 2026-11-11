import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Tariff } from '../tariffs/entities/tariff.entity';
import { UsersMeController } from './users.me.controller';
import { AuthModule } from '../auth/auth.module';
import { ReferralModule } from '../referral/referral.module';
import { UsersAdminController } from './users-admin.controller';
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Tariff]),
    AuthModule,
    ReferralModule,
  ],
  providers: [UsersService],
  controllers: [UsersMeController, UsersAdminController],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
