import { FastifyInstance } from 'fastify';

export const statsRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/stats', { preHandler: fastify.requireAuth }, async () => {
    const [totals, breaches, missing, avgDur, byTeam, byStatus] = await Promise.all([
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
        select coalesce(status_team, 'Unknown') as team, count(*)::int as count
        from tickets
        where current_status_sla = 'YES'
        group by status_team
        order by count desc
      `),
      fastify.db.query(`
        select coalesce(current_status, 'Unknown') as status, count(*)::int as count
        from tickets
        group by current_status
        order by count desc
        limit 15
      `),
    ]);

    const byTeamMap: Record<string, number> = {};
    for (const row of byTeam.rows) byTeamMap[row.team] = row.count;

    const byStatusMap: Record<string, number> = {};
    for (const row of byStatus.rows) byStatusMap[row.status] = row.count;

    return {
      totalTickets: totals.rows[0]?.count ?? 0,
      activeBreaches: breaches.rows[0]?.count ?? 0,
      missingDueDates: missing.rows[0]?.count ?? 0,
      avgStatusDuration: avgDur.rows[0]?.avg ?? 0,
      byTeam: byTeamMap,
      byStatus: byStatusMap,
    };
  });
};
