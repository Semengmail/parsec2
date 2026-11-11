import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/entities/user.entity';
import { JwtCookieGuard } from '@/common/guards/jwt-cookie.guard';
import { MailModule } from '../mail/mail.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { AUTH_RATE_LIMITS } from './auth-rate-limit';
import { AdminGuard } from '@/common/guards/admin.guard';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRoot(AUTH_RATE_LIMITS),
    forwardRef(() => UsersModule),
    TypeOrmModule.forFeature([User]),
    MailModule,
  ],
  providers: [AuthService, JwtCookieGuard, AdminGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtCookieGuard, AdminGuard],
})
export class AuthModule {}
