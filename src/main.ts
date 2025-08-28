/**
 * Main entry point for the Cursor AI PR Reviewer GitHub Action
 */

import * as core from '@actions/core';
import { getActionInputs, validateInputs } from './config';
import { PRReviewer } from './pr-reviewer';
import { logger } from './logger';

async function run(): Promise<void> {
  try {
    // Get and validate inputs
    const inputs = getActionInputs();
    validateInputs(inputs);

    core.info('🤖 Cursor AI PR Reviewer starting...');
    core.info(`AI Provider: ${inputs.aiProvider}`);
    core.info(`Review Level: ${inputs.reviewLevel}`);
    core.info(`Comment Style: ${inputs.commentStyle}`);

    // Create and run reviewer
    const reviewer = new PRReviewer(inputs);
    const result = await reviewer.reviewPR();

    // Log final results
    core.info(`📊 Review Summary:`);
    core.info(`  - Files Reviewed: ${result.filesReviewed}`);
    core.info(`  - Issues Found: ${result.issues.length}`);
    core.info(`  - Rules Applied: ${result.rulesApplied.length}`);
    core.info(`  - Status: ${result.status}`);

    if (result.status === 'failed') {
      core.setFailed(`Review failed with ${result.issues.filter(i => i.type === 'error').length} error(s)`);
    } else if (result.status === 'needs_attention') {
      core.warning(`Review completed with ${result.issues.length} issue(s) that need attention`);
    } else {
      core.info('✅ Review passed successfully!');
    }

  } catch (error) {
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
  logger.error('Unhandled error:', error);
  process.exit(1);
});
