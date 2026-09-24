import { BaseClient } from './BaseClient';
import type { Comment, CommentListQuery, CreateCommentPayload } from './types';

/** Comments on a task or on a project. */
export class CommentsClient extends BaseClient {
  async create(payload: CreateCommentPayload): Promise<Comment> {
    return this.postJson<Comment>('comments', payload);
  }

  async get(id: string): Promise<Comment> {
    return this.getJson<Comment>(`comments/${id}`);
  }

  async update(id: string, content: string): Promise<Comment> {
    return this.postJson<Comment>(`comments/${id}`, { content });
  }

  async delete(id: string): Promise<void> {
    await this.deleteResource(`comments/${id}`);
  }

  async list(query: CommentListQuery): Promise<Comment[]> {
    return this.listAll<Comment>('comments', { ...query });
  }
}
