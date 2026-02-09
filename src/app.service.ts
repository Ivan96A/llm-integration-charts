import {Injectable, OnModuleInit} from '@nestjs/common';
import {PrismaService} from './prisma.service';
import {pipeline} from '@huggingface/transformers';

export type ChartType = 'line' | 'bar' | 'bar-grouped' | 'pie' | 'funnel';

export interface LlmResult {
    success: boolean;
    error?: string;
    details?: string;
    echartsConfig?: Record<string, any>;
}

@Injectable()
export class AppService implements OnModuleInit {
    private generator: any;

    private buildChartConfig(chartType: ChartType, labels: string[], values: number[]): Record<string, any> {
        switch (chartType) {
            case 'line':
                return {
                    xAxis: { type: 'category', data: labels },
                    yAxis: { type: 'value' },
                    series: [{ type: 'line', data: values }]
                };
            case 'bar':
                return {
                    xAxis: { type: 'category', data: labels },
                    yAxis: { type: 'value' },
                    series: [{ type: 'bar', data: values }]
                };
            case 'bar-grouped':
                return {
                    xAxis: { type: 'category', data: labels },
                    yAxis: { type: 'value' },
                    series: [{ type: 'bar', data: values, barGap: '0%' }]
                };
            case 'pie':
                return {
                    series: [{
                        type: 'pie',
                        data: labels.map((label, i) => ({ name: label, value: values[i] }))
                    }]
                };
            case 'funnel':
                return {
                    series: [{
                        type: 'funnel',
                        data: labels.map((label, i) => ({ name: label, value: values[i] }))
                    }]
                };
            default:
                return {
                    xAxis: { type: 'category', data: labels },
                    yAxis: { type: 'value' },
                    series: [{ type: 'bar', data: values }]
                };
        }
    }

    private promt: string = `
      You are a data extraction engine.

Your task:
Extract paired categories and numeric amounts from the text below.

Rules:
- Categories must be concise labels describing each amount.
- Amounts must be numbers (integers or floats).
- Preserve the order in which they appear in the text.
- Do NOT invent or infer missing data.
- If no valid data is found, return empty arrays.
- Return ONLY valid JSON.
- Use original Ukrainian words for categories
- Do NOT include explanations, comments, or extra text.

Required JSON format:
{"categories": [{"label", "amount"}]}

Text to process:`

    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        console.log('Loading model...');
        this.generator = await pipeline(
            'text-generation',
            'Xenova/Qwen1.5-0.5B-Chat',
        );
        console.log('Model loaded');
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

    async analyze(text: string, requestId: number) {
        const finalPromt = this.generator.tokenizer.apply_chat_template([{
            role: 'user', content: this.prepareText(text)
        }], {
            tokenize: false,
            add_generation_prompt: true,
        });

        try {
            const result: Array<any> = await this.withTimeout(
                this.generator(finalPromt, {
                    max_new_tokens: 128,
                    do_sample: false,
                    return_full_text: false,
                }),
                120000
            );
            const generatedText = result[0].generated_text;
            console.log(result);
            await this.prisma.lLMResult.create({
                data: {
                    result: generatedText,
                    requestId,
                },
            });
            return JSON.parse(generatedText).categories;
        } catch (e) {
            throw new Error('Error during LLM processing ' + e.message);
        }
    }

    async generateChartResponse(llmResult: Array<{label: string, amount: number}>, requestId: number, chartType: ChartType = 'bar') {
        try {
            const labels = llmResult.map(item => item.label);
            const values = llmResult.map(item => item.amount);

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
        }
        catch (e) {
            throw new Error('Error during final response generation ' + e.message);
        }
    }

    private prepareText(text: string): string {
        text = text.replace('\n', ', ')
        if (text.includes(':')) {
            const [_, ...rest] = text.split(':')
            text = rest.join(':')
        }
        return this.promt + text;
    }

    private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error('Processing timeout exceeded')), timeoutMs)
            )
        ]);
    }
}
