export type ChartType = 'line' | 'bar' | 'bar-grouped' | 'pie' | 'funnel';

export interface ExtractedCategory {
    label: string;
    amount: number;
}

export interface LlmResult {
    success: boolean;
    error?: string;
    details?: string;
    echartsConfig?: Record<string, any>;
}
