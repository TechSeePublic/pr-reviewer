/**
 * Logging utility
 */

import * as core from '@actions/core';

export const logger = {
  info: (message: string) => {
    core.info(message);
  },
  
  warn: (message: string, error?: any) => {
    core.warning(message);
    if (error) {
      core.debug(`Warning details: ${error}`);
    }
  },
  
  error: (message: string, error?: any) => {
    core.error(message);
    if (error) {
      core.debug(`Error details: ${error}`);
    }
  },
  
  debug: (message: string) => {
    core.debug(message);
  }
};