"use strict";
/**
 * Main entry point for the Cursor AI PR Reviewer GitHub Action
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const config_1 = require("./config");
const pr_reviewer_1 = require("./pr-reviewer");
const logger_1 = require("./logger");
async function run() {
    try {
        // Get and validate inputs
        const inputs = (0, config_1.getActionInputs)();
        (0, config_1.validateInputs)(inputs);
        core.info('🤖 Cursor AI PR Reviewer starting...');
        core.info(`AI Provider: ${inputs.aiProvider}`);
        core.info(`Review Level: ${inputs.reviewLevel}`);
        core.info(`Comment Style: ${inputs.commentStyle}`);
        // Create and run reviewer
        const reviewer = new pr_reviewer_1.PRReviewer(inputs);
        const result = await reviewer.reviewPR();
        // Log final results
        core.info(`📊 Review Summary:`);
        core.info(`  - Files Reviewed: ${result.filesReviewed}`);
        core.info(`  - Issues Found: ${result.issues.length}`);
        core.info(`  - Rules Applied: ${result.rulesApplied.length}`);
        core.info(`  - Status: ${result.status}`);
        if (result.status === 'failed') {
            core.setFailed(`Review failed with ${result.issues.filter(i => i.type === 'error').length} error(s)`);
        }
        else if (result.status === 'needs_attention') {
            core.warning(`Review completed with ${result.issues.length} issue(s) that need attention`);
        }
        else {
            core.info('✅ Review passed successfully!');
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.setFailed(`Action failed: ${errorMessage}`);
        // Log stack trace for debugging
        if (error instanceof Error && error.stack) {
            core.debug(`Stack trace: ${error.stack}`);
        }
    }
}
// Run the action
run().catch(error => {
    logger_1.logger.error('Unhandled error:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map