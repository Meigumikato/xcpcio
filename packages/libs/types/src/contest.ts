import type { BalloonColor, DateTimeISO8601String, Image } from "./basic-types";
import type { Problem } from "./problem";

export enum ContestState {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  FROZEN = "FROZEN",
  FINISHED = "FINISHED",
}

export interface Contest {
  contest_name: string;

  start_time: number | DateTimeISO8601String;
  end_time: number | DateTimeISO8601String;
  freeze_time?: number | DateTimeISO8601String;

  frozen_time?: number; // unit: seconds
  penalty: number; // unit: seconds

  problems?: Array<Problem>;
  problem_id?: Array<string>;

  organization?: string;
  status_time_display?: Record<string, boolean>;

  badge?: string;
  medal?: Record<string, Record<string, number>>;
  balloon_color?: Array<BalloonColor>;

  group?: Record<string, string>;
  tag?: Record<string, string>;

  logo?: Image;
  banner?: Image;
  board_link?: string;

  version?: string;
}
