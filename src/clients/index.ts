import type { APIRequestContext } from '@playwright/test';

import { CommentsClient } from './CommentsClient';
import { LabelsClient } from './LabelsClient';
import { ProjectsClient } from './ProjectsClient';
import { TasksClient } from './TasksClient';
import { UserClient } from './UserClient';

export { ApiError, RequestFailedError } from './ApiError';
export { BaseClient, type HttpMethod, type Page, type RequestOptions } from './BaseClient';
export { createApiContext, createUnauthenticatedContext } from './createApiContext';
export type * from './types';
export { CommentsClient, LabelsClient, ProjectsClient, TasksClient, UserClient };

/** All resource clients, sharing one request context. */
export interface TodoistApi {
  projects: ProjectsClient;
  tasks: TasksClient;
  labels: LabelsClient;
  comments: CommentsClient;
  user: UserClient;
}

export function createTodoistApi(request: APIRequestContext): TodoistApi {
  return {
    projects: new ProjectsClient(request),
    tasks: new TasksClient(request),
    labels: new LabelsClient(request),
    comments: new CommentsClient(request),
    user: new UserClient(request),
  };
}
