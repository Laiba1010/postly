export const PUBLISH_QUEUE_NAME = 'publish-post-target';

export const JOB_OPTIONS = {
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 100 },
} as const;
