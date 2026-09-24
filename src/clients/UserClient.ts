import { BaseClient } from './BaseClient';
import type { User } from './types';

/** The account that owns the API token. Used to read settings such as the timezone. */
export class UserClient extends BaseClient {
  async get(): Promise<User> {
    return this.getJson<User>('user');
  }
}
