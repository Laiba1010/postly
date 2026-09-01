import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PasswordModule } from './password/password.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [UsersModule, PasswordModule, SessionsModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
