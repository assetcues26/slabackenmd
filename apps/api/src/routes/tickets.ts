import { FastifyInstance } from 'fastify';

type TicketQuery = {
  limit?: string;
  offset?: string;
  status?: string;
  sla?: string;
  team?: string;
  missingDueDate?: string;
  search?: string;
};

export const ticketRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/tickets', { preHandler: fastify.requireAuth }, async (request) => {
    const { limit, offset, status, sla, team, missingDueDate, search } =
      request.query as TicketQuery;
    const safeLimit = Math.min(Number(limit) || 50, 200);
    const safeOffset = Number(offset) || 0;

    const conditions: string[] = [];
    const params: Array<string | number | boolean> = [];

    if (status) {
      params.push(status);
      conditions.push(`current_status = $${params.length}`);
    }
    if (sla === 'breached') {
      conditions.push("current_status_sla = 'YES'");
    }
    if (team) {
      params.push(team);
      conditions.push(`status_team = $${params.length}`);
    }
    if (missingDueDate === 'true') {
      conditions.push('due_date_missing = true');
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(ticket_key ilike $${params.length} or summary ilike $${params.length} or assignee ilike $${params.length})`,
      );
    }

    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    params.push(safeLimit, safeOffset);

    const query = `
      select
        ticket_key,
        summary,
        assignee,
        priority,
        current_status,
        current_status_start,
        current_status_duration,
        current_status_sla,
        current_status_sla_threshold,
        status_team,
        status_category,
        due_date,
        due_date_missing,
        jira_ticket_url,
        project,
        reporter,
        issue_type,
        todo_sla,
        inprogress_sla,
        updated,
        created
      from tickets
      ${where}
      order by
        case when current_status_sla = 'YES' then 0 else 1 end,
        case when due_date_missing then 0 else 1 end,
        updated desc nulls last
      limit $${params.length - 1}
      offset $${params.length}
    `;

    const countQuery = `
      select count(*)::int as count from tickets ${where}
    `;
    const countParams = params.slice(0, -2);

    const [result, countResult] = await Promise.all([
      fastify.db.query(query, params),
      fastify.db.query(countQuery, countParams),
    ]);

    return {
      items: result.rows,
      total: countResult.rows[0]?.count ?? 0,
      limit: safeLimit,
      offset: safeOffset,
    };
  });

  fastify.get('/tickets/breaches', { preHandler: fastify.requireAuth }, async (request) => {
    const { limit, offset } = request.query as TicketQuery;
    const safeLimit = Math.min(Number(limit) || 100, 200);
    const safeOffset = Number(offset) || 0;

    const query = `
      select *
      from tickets
      where current_status_sla = 'YES' or due_date_missing = true
      order by
        case when due_date_missing then 0 else 1 end,
        current_status_duration desc nulls last
      limit $1 offset $2
    `;

    const result = await fastify.db.query(query, [safeLimit, safeOffset]);
    return { items: result.rows };
  });

  fastify.get('/tickets/:ticketKey', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { ticketKey } = request.params as { ticketKey: string };
    const result = await fastify.db.query('select * from tickets where ticket_key = $1', [
      ticketKey,
    ]);

    if (!result.rows.length) {
      reply.code(404).send({ error: 'Ticket not found' });
      return;
    }

    return result.rows[0];
  });
};
