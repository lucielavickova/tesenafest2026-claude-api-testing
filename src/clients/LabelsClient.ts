import { BaseClient } from './BaseClient';
import type { CreateLabelPayload, Label, UpdateLabelPayload } from './types';

/** Personal labels. */
export class LabelsClient extends BaseClient {
  async create(payload: CreateLabelPayload): Promise<Label> {
    return this.postJson<Label>('labels', payload);
  }

  async get(id: string): Promise<Label> {
    return this.getJson<Label>(`labels/${id}`);
  }

  async update(id: string, payload: UpdateLabelPayload): Promise<Label> {
    return this.postJson<Label>(`labels/${id}`, payload);
  }

  async delete(id: string): Promise<void> {
    await this.deleteResource(`labels/${id}`);
  }

  async list(): Promise<Label[]> {
    return this.listAll<Label>('labels');
  }
}
