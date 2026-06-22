import slaConfigRaw from './sla_timing.json';

export type SlaTiming = number | 'Due Date';

export type StatusCategory = 'Main' | 'Sub' | 'Final' | 'Unknown';

export interface WorkflowEntry {
  team: string | null;
  status: string | null;
}

export interface SlaRow {
  main_status: string | null;
  timings: Record<string, SlaTiming>;
  workflow: WorkflowEntry[];
}

export interface StatusMeta {
  category: StatusCategory;
  team: string | null;
  mainStatus: string | null;
  timings: Record<string, SlaTiming>;
}

export const slaConfig = slaConfigRaw as SlaRow[];

export const statusMetaByStatus: Record<string, StatusMeta> = (() => {
  const map: Record<string, StatusMeta> = {};

  const addMeta = (
    status: string | null,
    category: StatusCategory,
    team: string | null,
    mainStatus: string | null,
    timings: Record<string, SlaTiming>,
  ) => {
    if (!status) return;
    map[status] = {
      category,
      team: team ?? null,
      mainStatus: mainStatus ?? null,
      timings,
    };
  };

  for (const row of slaConfig) {
    const workflow = Array.isArray(row.workflow) ? row.workflow : [];
    const mainStatus = row.main_status ?? null;
    const timings = row.timings ?? {};

    const mainTeam = workflow[0]?.team ?? null;
    const subStatus = workflow[0]?.status ?? null;
    const subTeam = workflow[1]?.team ?? null;
    const finalStatus = workflow[1]?.status ?? null;
    const finalTeam = workflow[2]?.team ?? null;

    if (mainStatus) {
      addMeta(mainStatus, 'Main', mainTeam, mainStatus, timings);
    }
    if (subStatus) {
      addMeta(subStatus, 'Sub', subTeam, mainStatus, timings);
    }
    if (finalStatus) {
      addMeta(finalStatus, 'Final', finalTeam, mainStatus, timings);
    }
  }

  return map;
})();

export const getTimingForPriority = (
  timings: Record<string, SlaTiming>,
  priorityName?: string | null,
): SlaTiming | null => {
  const keys = Object.keys(timings || {});
  if (!keys.length) return null;

  if (priorityName) {
    const match = keys.find((k) => k.toLowerCase() === priorityName.toLowerCase());
    if (match) return timings[match];
  }

  return timings.Highest ?? timings.High ?? timings.Medium ?? null;
};

export const isDueDateTiming = (value: SlaTiming | null): boolean => {
  return typeof value === 'string' && value.trim().toLowerCase() === 'due date';
};

export const normalizeTimingToMinutes = (value: SlaTiming | null): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return Math.round(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const lower = trimmed.toLowerCase();
    if (lower === 'due date') return null;
    const hrsMatch = lower.match(/^(\d+(?:\.\d+)?)\s*hrs?$/);
    if (hrsMatch) return Math.round(parseFloat(hrsMatch[1]) * 60);
    const minMatch = lower.match(/^(\d+(?:\.\d+)?)\s*min(?:s)?$/);
    if (minMatch) return Math.round(parseFloat(minMatch[1]));
    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber)) return Math.round(asNumber);
  }
  return null;
};

export type TicketRow = {
  ticket_key: string;
  summary: string | null;
  assignee: string | null;
  priority: string | null;
  current_status: string | null;
  current_status_duration: number | null;
  current_status_sla: string | null;
  current_status_sla_threshold: number | null;
  status_team: string | null;
  status_category: string | null;
  due_date: string | null;
  due_date_missing: boolean | null;
  jira_ticket_url: string | null;
  updated: string | null;
  project: string | null;
  todo_sla: string | null;
  inprogress_sla: string | null;
};

export type DashboardStats = {
  totalTickets: number;
  activeBreaches: number;
  missingDueDates: number;
  avgStatusDuration: number;
  byTeam: Record<string, number>;
  byStatus: Record<string, number>;
};
