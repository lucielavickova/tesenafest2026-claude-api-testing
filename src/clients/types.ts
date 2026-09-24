/**
 * Types for the parts of Todoist API v1 used by the tests.
 * They follow the component schemas in src/schemas/openapi.json (named in the comments).
 * Tests check the full response shape with `toMatchSchema`, so only the fields the tests read
 * are listed here.
 */

export type Color =
  | 'berry_red'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'olive_green'
  | 'lime_green'
  | 'green'
  | 'mint_green'
  | 'teal'
  | 'sky_blue'
  | 'light_blue'
  | 'blue'
  | 'grape'
  | 'violet'
  | 'lavender'
  | 'magenta'
  | 'salmon'
  | 'charcoal'
  | 'grey'
  | 'taupe';

/** 1 is normal, 4 is urgent (shown as P1 in the apps). */
export type Priority = 1 | 2 | 3 | 4;

/** PersonalProjectSyncView (part of AnyProjectSyncViewResponse). */
export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  parent_id: string | null;
  child_order: number;
  is_favorite: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  is_shared: boolean;
  inbox_project?: boolean;
  view_style: string;
  created_at: string | null;
  updated_at: string | null;
}

/** Body_207bf8bc */
export interface CreateProjectPayload {
  name: string;
  description?: string;
  parent_id?: string;
  color?: Color;
  is_favorite?: boolean;
  view_style?: 'list' | 'board' | 'calendar';
}

/** Body_cb8d28ec */
export type UpdateProjectPayload = Partial<Omit<CreateProjectPayload, 'parent_id'>>;

/** `due` of ItemSyncView. The spec only says "object", these fields are from the API docs. */
export interface Due {
  /** `YYYY-MM-DD`, or a date-time for tasks with a time. */
  date: string;
  string: string;
  lang: string;
  is_recurring: boolean;
  timezone?: string | null;
}

/** ItemSyncView */
export interface Task {
  id: string;
  user_id: string;
  project_id: string;
  section_id: string | null;
  parent_id: string | null;
  content: string;
  description: string;
  labels: string[];
  priority: number;
  due: Due | null;
  deadline: { date: string; lang?: string } | null;
  duration: { amount: number; unit: 'minute' | 'day' } | null;
  checked: boolean;
  is_deleted: boolean;
  child_order: number;
  note_count: number;
  added_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
}

/** Body_37565102 (sections are out of scope, so `section_id` is left out). */
export interface CreateTaskPayload {
  content: string;
  description?: string;
  project_id?: string;
  parent_id?: string;
  order?: number;
  labels?: string[];
  priority?: Priority;
  assignee_id?: number;
  due_string?: string;
  due_date?: string;
  due_datetime?: string;
  due_lang?: string;
  duration?: number;
  duration_unit?: 'minute' | 'day';
  deadline_date?: string;
}

/** Body_829067ab */
export type UpdateTaskPayload = Partial<
  Pick<
    CreateTaskPayload,
    | 'content'
    | 'description'
    | 'labels'
    | 'priority'
    | 'due_string'
    | 'due_date'
    | 'due_datetime'
    | 'due_lang'
    | 'duration'
    | 'duration_unit'
    | 'deadline_date'
  >
>;

/** Filters of GET /tasks. */
export interface TaskListQuery {
  project_id?: string;
  parent_id?: string;
  label?: string;
  /** Comma separated task ids. */
  ids?: string;
}

/** LabelRestView */
export interface Label {
  id: string;
  name: string;
  color: string;
  order: number | null;
  is_favorite: boolean;
}

/** Body_38bb43e2 */
export interface CreateLabelPayload {
  name: string;
  order?: number;
  color?: Color;
  is_favorite?: boolean;
}

export type UpdateLabelPayload = Partial<CreateLabelPayload>;

/** NoteSyncView */
export interface Comment {
  id: string;
  content: string;
  posted_uid: string | null;
  posted_at: string | null;
  is_deleted: boolean;
  /** Returned by the API, not listed in the spec schema. */
  item_id?: string;
  project_id?: string;
}

/** Body_28d2b1b0: exactly one of `task_id` and `project_id`. */
export type CreateCommentPayload =
  { content: string; task_id: string } | { content: string; project_id: string };

export type CommentListQuery = { task_id: string } | { project_id: string };

/** UserJSON */
export interface User {
  id: string;
  email: string;
  full_name: string;
  is_premium: boolean;
  inbox_project_id: string | null;
  tz_info: {
    /** IANA timezone name, for example `Europe/Prague`. */
    timezone: string;
    gmt_string: string;
    hours: number;
    minutes: number;
    is_dst: number;
  };
}
