import { FastifyInstance } from 'fastify';

const STATS_TTL_MS = 20_000;
let statsCache: { at: number; data: unknown } | null = null;

const STATS_SQL = `
with t as (select * from tickets)
select json_build_object(
  'totalTickets', (select count(*)::int from t),
  'activeBreaches', (select count(*)::int from t where current_status_sla = 'YES'),
  'missingDueDates', (select count(*)::int from t where due_date_missing = true),
  'avgStatusDuration', (select coalesce(round(avg(current_status_duration)), 0)::int from t where current_status_duration is not null),
  'byTeam', (select coalesce(json_object_agg(k, c), '{}'::json) from (
    select coalesce(status_team, 'Unknown') k, count(*)::int c from t where current_status_sla = 'YES' group by 1
  ) s),
  'byStatus', (select coalesce(json_object_agg(k, c), '{}'::json) from (
    select coalesce(current_status, 'Unknown') k, count(*)::int c from t group by 1 order by c desc limit 15
  ) s),
  'byPriority', (select coalesce(json_object_agg(k, c), '{}'::json) from (
    select coalesce(priority, 'Unknown') k, count(*)::int c from t group by 1
  ) s),
  'byCategory', (select coalesce(json_object_agg(k, c), '{}'::json) from (
    select coalesce(status_category, 'Unknown') k, count(*)::int c from t group by 1
  ) s),
  'byIssueType', (select coalesce(json_object_agg(k, c), '{}'::json) from (
    select coalesce(issue_type, 'Unknown') k, count(*)::int c from t group by 1
  ) s),
  'byProject', (select coalesce(json_object_agg(k, c), '{}'::json) from (
    select coalesce(project, 'Unknown') k, count(*)::int c from t group by 1
  ) s),
  'allTeams', (select coalesce(json_agg(team order by team), '[]'::json) from (
    select distinct status_team team from t where status_team is not null and status_team <> ''
  ) s),
  'slaByPhase', json_build_object(
    'todo', json_build_object(
      'breached', (select count(*)::int from t where todo_sla = 'YES'),
      'total', (select count(*)::int from t where todo_sla is not null and todo_sla <> '')
    ),
    'inprogress', json_build_object(
      'breached', (select count(*)::int from t where inprogress_sla = 'YES'),
      'total', (select count(*)::int from t where inprogress_sla is not null and inprogress_sla <> '')
    ),
    'current', json_build_object(
      'breached', (select count(*)::int from t where current_status_sla = 'YES'),
      'total', (select count(*)::int from t where current_status_sla is not null and current_status_sla <> '')
    )
  ),
  'createdTrend', (select coalesce(json_agg(json_build_object('day', d, 'count', c) order by d), '[]'::json) from (
    select to_char(date_trunc('day', created), 'YYYY-MM-DD') d, count(*)::int c from t where created is not null group by 1
  ) s),
  'avgDurationByStatus', (select coalesce(json_agg(json_build_object('status', status, 'avg', a) order by a desc), '[]'::json) from (
    select coalesce(current_status, 'Unknown') status, coalesce(round(avg(current_status_duration)), 0)::int a
    from t where current_status_duration is not null group by 1 order by a desc limit 10
  ) s)
) as result
`;

export const statsRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/stats', { preHandler: fastify.requireAuth }, async (_request, reply) => {
    const now = Date.now();
    if (statsCache && now - statsCache.at < STATS_TTL_MS) {
      reply.header('x-cache', 'HIT');
      return statsCache.data;
    }

    const result = await fastify.db.query(STATS_SQL);
    const data = result.rows[0]?.result ?? {};
    statsCache = { at: now, data };
    reply.header('x-cache', 'MISS');
    return data;
  });
};
