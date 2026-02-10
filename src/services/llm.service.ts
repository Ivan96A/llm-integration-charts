import {Injectable, OnModuleInit} from '@nestjs/common';
import {pipeline} from '@huggingface/transformers';
import {ChartType, ExtractedCategory} from '../types';

@Injectable()
export class LlmService implements OnModuleInit {
    private generator: any;

    private readonly dataExtractionPrompt: string = `
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

Text to process:`;

    async onModuleInit() {
        console.log('Loading model...');
        this.generator = await pipeline(
            'text-generation',
            'Xenova/Qwen1.5-0.5B-Chat',
        );
        console.log('Model loaded');
    }

    async extractData(text: string): Promise<ExtractedCategory[]> {
        const preparedText = this.prepareText(text);
        const finalPrompt = this.generator.tokenizer.apply_chat_template([{
            role: 'user', content: preparedText
        }], {
            tokenize: false,
            add_generation_prompt: true,
        });

        const result: Array<any> = await this.withTimeout(
            this.generator(finalPrompt, {
                max_new_tokens: 128,
                do_sample: false,
                return_full_text: false,
            }),
            120000
        );

        const generatedText = result[0].generated_text;
        console.log('LLM extraction result:', result);

        return JSON.parse(generatedText).categories;
    }

    async identifyChartType(originalText: string): Promise<ChartType> {
        const chartOptions: ChartType[] = ['bar', 'line', 'pie', 'funnel', 'bar-grouped'];

        const prompt = `What number best describes this data?

1 = comparing items (продажі, продуктивність)
2 = change over time (температура, витрати за кварталами)
3 = parts of whole (розподіл бюджету, частки)
4 = stages decreasing (воронка, етапи, конверсія)
5 = comparing groups (порівняння груп)

Data: ${originalText}

Reply with number 1-5:`;

        const finalPrompt = this.generator.tokenizer.apply_chat_template([{
            role: 'user', content: prompt
        }], {
            tokenize: false,
            add_generation_prompt: true,
        });

        try {
            const result: Array<any> = await this.generator(finalPrompt, {
                max_new_tokens: 5,
                do_sample: false,
                return_full_text: false,
            });

            const answer = result[0].generated_text.trim();
            console.log('LLM chart type answer:', answer);

            const numMatch = answer.match(/[1-5]/);
            if (numMatch) {
                const index = parseInt(numMatch[0]) - 1;
                return chartOptions[index];
            }

            return 'bar';
        } catch (e) {
            console.error('Chart type identification failed:', e.message);
            return 'bar';
        }
    }

    private prepareText(text: string): string {
        text = text.replace('\n', ', ');
        if (text.includes(':')) {
            const [_, ...rest] = text.split(':');
            text = rest.join(':');
        }
        return this.dataExtractionPrompt + text;
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
