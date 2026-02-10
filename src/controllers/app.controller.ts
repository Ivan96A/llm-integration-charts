import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import {AppService} from '../services/app.service';
import {LlmResult} from '../types';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('api/analyze')
  @HttpCode(200)
  async analyze(@Body() body: { text: string }): Promise<LlmResult> {
      if (!body.text || body.text.length > 1024) {
          return {
              "success": false,
              "error": "Помилка валідації",
              "details": "Текст повинен бути не більше 1024 символів"
          }
      }

      try {
          const request = await this.appService.storeRequest(JSON.stringify(body));
          const llmResult = await this.appService.extractAndStoreCategories(body.text, request.id);
          return this.appService.generateChartResponse(body.text, llmResult, request.id)
      }
      catch (e) {
          return {
              "success": false,
              "error": "Помилка обробки тексту",
              "details": e.message
          }
      }
  }
}
