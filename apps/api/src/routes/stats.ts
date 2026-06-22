import { FastifyInstance } from 'fastify';

const toMap = (rows: Array<{ key: string; count: number }>): Record<string, number> => {
  const map: Record<string, number> = {};
  for (const row of rows) map[row.key] = row.count;
  return map;
};

export const statsRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/stats', { preHandler: fastify.requireAuth }, async () => {
    const [
      totals,
      breaches,
      missing,
      avgDur,
      byTeam,
      byStatus,
      byPriority,
      byCategory,
      byIssueType,
      byProject,
      slaPhase,
      createdTrend,
      avgByStatus,
    ] = await Promise.all([
      fastify.db.query('select count(*)::int as count from tickets'),
      fastify.db.query(
        "select count(*)::int as count from tickets where current_status_sla = 'YES'",
      ),
      fastify.db.query(
        'select count(*)::int as count from tickets where due_date_missing = true',
      ),
      fastify.db.query(
        'select coalesce(round(avg(current_status_duration)), 0)::int as avg from tickets where current_status_duration is not null',
      ),
      fastify.db.query(`
        select coalesce(status_team, 'Unknown') as key, count(*)::int as count
        from tickets
        where current_status_sla = 'YES'
        group by status_team
        order by count desc
      `),
      fastify.db.query(`
        select coalesce(current_status, 'Unknown') as key, count(*)::int as count
        from tickets
        group by current_status
        order by count desc
        limit 15
      `),
      fastify.db.query(`
        select coalesce(priority, 'Unknown') as key, count(*)::int as count
        from tickets
        group by priority
        order by count desc
      `),
      fastify.db.query(`
        select coalesce(status_category, 'Unknown') as key, count(*)::int as count
        from tickets
        group by status_category
        order by count desc
      `),
      fastify.db.query(`
        select coalesce(issue_type, 'Unknown') as key, count(*)::int as count
        from tickets
        group by issue_type
        order by count desc
      `),
      fastify.db.query(`
        select coalesce(project, 'Unknown') as key, count(*)::int as count
        from tickets
        group by project
        order by count desc
      `),
      fastify.db.query(`
        select
          count(*) filter (where todo_sla = 'YES')::int as todo_breached,
          count(*) filter (where todo_sla is not null and todo_sla <> '')::int as todo_total,
          count(*) filter (where inprogress_sla = 'YES')::int as inprogress_breached,
          count(*) filter (where inprogress_sla is not null and inprogress_sla <> '')::int as inprogress_total,
          count(*) filter (where current_status_sla = 'YES')::int as current_breached,
          count(*) filter (where current_status_sla is not null and current_status_sla <> '')::int as current_total
        from tickets
      `),
      fastify.db.query(`
        select to_char(date_trunc('day', created), 'YYYY-MM-DD') as day, count(*)::int as count
        from tickets
        where created is not null
        group by 1
        order by 1 asc
        limit 60
      `),
      fastify.db.query(`
        select coalesce(current_status, 'Unknown') as status,
               coalesce(round(avg(current_status_duration)), 0)::int as avg
        from tickets
        where current_status_duration is not null
        group by current_status
        order by avg desc
        limit 10
      `),
    ]);

    const phase = slaPhase.rows[0] ?? {};

    return {
      totalTickets: totals.rows[0]?.count ?? 0,
      activeBreaches: breaches.rows[0]?.count ?? 0,
      missingDueDates: missing.rows[0]?.count ?? 0,
      avgStatusDuration: avgDur.rows[0]?.avg ?? 0,
      byTeam: toMap(byTeam.rows),
      byStatus: toMap(byStatus.rows),
      byPriority: toMap(byPriority.rows),
      byCategory: toMap(byCategory.rows),
      byIssueType: toMap(byIssueType.rows),
      byProject: toMap(byProject.rows),
      slaByPhase: {
        todo: { breached: phase.todo_breached ?? 0, total: phase.todo_total ?? 0 },
        inprogress: {
          breached: phase.inprogress_breached ?? 0,
          total: phase.inprogress_total ?? 0,
        },
        current: { breached: phase.current_breached ?? 0, total: phase.current_total ?? 0 },
      },
      createdTrend: createdTrend.rows.map((row) => ({ day: row.day, count: row.count })),
      avgDurationByStatus: avgByStatus.rows.map((row) => ({
        status: row.status,
        avg: row.avg,
      })),
    };
  });
};
