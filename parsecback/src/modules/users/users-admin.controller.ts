import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieGuard } from '@/common/guards/jwt-cookie.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Controller('api/v1/admin/users')
@UseGuards(JwtCookieGuard)
export class UsersAdminController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(
    @CurrentUser() user: User,
    @Query('page') page = '1',
    @Query('limit') limit = '300',
    @Query('search') search?: string,
  ) {
    this.assertAdmin(user);
    return this.users.getAdminUsers({
      page: Number(page),
      limit: Number(limit),
      search,
    });
  }

  @Delete(':id/balance')
  async clearBalance(@CurrentUser() user: User, @Param('id') id: string) {
    this.assertAdmin(user);
    return this.users.clearAdminUserBalance(Number(id));
  }

  private assertAdmin(user: User): void {
    if (!user.role?.includes('admin'))
      throw new ForbiddenException('admin_only');
  }
}
