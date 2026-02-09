import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import {AppService, LlmResult, ChartType} from './app.service';

const VALID_CHART_TYPES: ChartType[] = ['line', 'bar', 'bar-grouped', 'pie', 'funnel'];

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('api/analyze')
  @HttpCode(200)
  async analyze(@Body() body: { text: string, chartType?: ChartType }): Promise<LlmResult> {
      if (!body.text || body.text.length > 1024) {
          return {
              "success": false,
              "error": "Помилка валідації",
              "details": "Текст повинен бути не більше 1024 символів"
          }
      }

      const chartType = body.chartType || 'bar';
      if (!VALID_CHART_TYPES.includes(chartType)) {
          return {
              "success": false,
              "error": "Помилка валідації",
              "details": `Невірний тип діаграми. Допустимі: ${VALID_CHART_TYPES.join(', ')}`
          }
      }

      try {
          const request = await this.appService.storeRequest(JSON.stringify(body));
          const llmResult = await this.appService.analyze(body.text, request.id);
          return this.appService.generateChartResponse(llmResult, request.id, chartType)
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
