"use strict";
/**
 * Base class for AI providers with shared functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAIProvider = void 0;
const utils_1 = require("./utils");
class BaseAIProvider {
    constructor(deterministicMode = true) {
        this.deterministicMode = deterministicMode;
    }
    // Shared utility methods
    parseAIResponse(response) {
        return utils_1.AIProviderUtils.parseAIResponse(response, this.deterministicMode);
    }
    extractIssuesFromText(text) {
        return utils_1.AIProviderUtils.extractIssuesFromText(text);
    }
    parsePRPlanResponse(response) {
        return utils_1.AIProviderUtils.parsePRPlanResponse(response);
    }
    parseArchitecturalResponse(response) {
        return utils_1.AIProviderUtils.parseArchitecturalResponse(response);
    }
    assignFilesToIssues(issues, files) {
        return utils_1.AIProviderUtils.assignFilesToIssues(issues, files);
    }
    matchIssueToFile(issue, files) {
        return utils_1.AIProviderUtils.matchIssueToFile(issue, files);
    }
    extractErrorMessage(error) {
        return utils_1.AIProviderUtils.extractErrorMessage(error);
    }
}
exports.BaseAIProvider = BaseAIProvider;
//# sourceMappingURL=base-provider.js.map