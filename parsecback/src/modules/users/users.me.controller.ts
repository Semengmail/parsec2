import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtCookieGuard } from '@/common/guards/jwt-cookie.guard';
import { UserId } from '@/common/decorators/user-id.decorator';
import { UsersService } from './users.service';

@Controller('users/me')
@UseGuards(JwtCookieGuard)
export class UsersMeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async me(@UserId() userId: number) {
    const u = await this.users.getUserById(userId);

    return {
      id: u.id,
      email: u.email ?? null,
      name: u.name ?? null,
      balance: u.balance,
    };
  }

  @Get('balance')
  async balance(@UserId() userId: number): Promise<{ balance: string }> {
    const u = await this.users.getUserById(userId);
    return { balance: u.balance };
  }

  @Post('api-key/rotate')
  async rotateApiKey(@UserId() userId: number): Promise<{ apiKey: string }> {
    return this.users.rotateApiKey(userId);
  }
}
