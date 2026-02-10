import { Module } from '@nestjs/common';
import { AppController } from './controllers/app.controller';
import { AppService } from './services/app.service';
import { PrismaService } from './services/prisma.service';
import { LlmService } from './services/llm.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, PrismaService, LlmService],
})
export class AppModule {}
