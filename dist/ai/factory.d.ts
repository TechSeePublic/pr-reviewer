/**
 * Factory for creating AI providers
 */
import { ActionInputs, AIProvider } from '../types';
export declare class AIProviderFactory {
    static create(inputs: ActionInputs): AIProvider;
    static resolveProviderAndModel(inputs: ActionInputs): {
        provider: string;
        model: string;
    };
    static getAvailableProviders(inputs: ActionInputs): string[];
    static getModelRecommendations(reviewLevel: string): Record<string, string>;
}
//# sourceMappingURL=factory.d.ts.map