import { BaseClient } from './BaseClient';
import type { CreateTaskPayload, Task, TaskListQuery, UpdateTaskPayload } from './types';

export class TasksClient extends BaseClient {
  async create(payload: CreateTaskPayload): Promise<Task> {
    return this.postJson<Task>('tasks', payload);
  }

  async get(id: string): Promise<Task> {
    return this.getJson<Task>(`tasks/${id}`);
  }

  async update(id: string, payload: UpdateTaskPayload): Promise<Task> {
    return this.postJson<Task>(`tasks/${id}`, payload);
  }

  async delete(id: string): Promise<void> {
    await this.deleteResource(`tasks/${id}`);
  }

  /** Active (not completed) tasks matching the filter, across all pages. */
  async list(query: TaskListQuery = {}): Promise<Task[]> {
    return this.listAll<Task>('tasks', { ...query });
  }

  /** Completes the task. A recurring task moves to its next due date instead. */
  async close(id: string): Promise<void> {
    await this.postEmpty(`tasks/${id}/close`);
  }

  /** Puts a completed task back among the active ones. */
  async reopen(id: string): Promise<void> {
    await this.postEmpty(`tasks/${id}/reopen`);
  }
}
