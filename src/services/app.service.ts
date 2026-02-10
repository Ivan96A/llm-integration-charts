import {Injectable} from '@nestjs/common';
import {PrismaService} from './prisma.service';
import {LlmService} from './llm.service';
import {ChartType, ExtractedCategory, LlmResult} from '../types';

@Injectable()
export class AppService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly llmService: LlmService,
    ) {}

    private buildChartConfig(chartType: ChartType, labels: string[], values: number[]): Record<string, any> {
        switch (chartType) {
            case 'line':
                return {
                    xAxis: {type: 'category', data: labels},
                    yAxis: {type: 'value'},
                    series: [{type: 'line', data: values}]
                };
            case 'bar':
                return {
                    xAxis: {type: 'category', data: labels},
                    yAxis: {type: 'value'},
                    series: [{type: 'bar', data: values}]
                };
            case 'bar-grouped':
                return {
                    xAxis: {type: 'category', data: labels},
                    yAxis: {type: 'value'},
                    series: [{type: 'bar', data: values, barGap: '0%'}]
                };
            case 'pie':
                return {
                    series: [{
                        type: 'pie',
                        data: labels.map((label, i) => ({name: label, value: values[i]}))
                    }]
                };
            case 'funnel':
                return {
                    series: [{
                        type: 'funnel',
                        data: labels.map((label, i) => ({name: label, value: values[i]}))
                    }]
                };
            default:
                return {
                    xAxis: {type: 'category', data: labels},
                    yAxis: {type: 'value'},
                    series: [{type: 'bar', data: values}]
                };
        }
    }

    async storeRequest(text: string) {
        try {
            return this.prisma.request.create({
                data: {text},
            });
        } catch (e) {
            throw new Error('Error during original request storing ' + e.message);
        }
    }

    async extractAndStoreCategories(text: string, requestId: number) {
        try {
            const categories = await this.llmService.extractData(text);

            await this.prisma.lLMResult.create({
                data: {
                    result: JSON.stringify(categories),
                    requestId,
                },
            });

            return categories;
        } catch (e) {
            throw new Error('Error during LLM processing ' + e.message);
        }
    }

    async generateChartResponse(originalText: string, extractedData: ExtractedCategory[], requestId: number) {
        try {
            const labels = extractedData.map(item => item.label);
            const values = extractedData.map(item => item.amount);
            const chartType = await this.llmService.identifyChartType(originalText);
            const response: LlmResult = {
                success: true,
                echartsConfig: this.buildChartConfig(chartType, labels, values)
            };

            await this.prisma.finalResponse.create({
                data: {
                    data: JSON.stringify(response),
                    requestId,
                },
            });

            return response;
        } catch (e) {
            throw new Error('Error during final response generation ' + e.message);
        }
    }
}
