const { getPool, json, requireDbUrl, checkAdmin } = require('./_db');

function parseBody(event) {
  try { return event.body ? JSON.parse(event.body) : {}; }
  catch { return {}; }
}

async function getAllData(db) {
  const tours = await db.query(`SELECT id, name, emoji, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, sort_order FROM tours ORDER BY sort_order, start_date, id`);
  const days = await db.query(`SELECT id, tour_id, name, short_label, to_char(day_date, 'YYYY-MM-DD') AS day_date, sort_order FROM days ORDER BY sort_order, day_date, id`);
  const activities = await db.query(`SELECT id, day_id, time, title, small, big, needs, sort_order FROM activities ORDER BY sort_order, id`);
  return { tours: tours.rows, days: days.rows, activities: activities.rows };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

  try {
    requireDbUrl();
    const db = getPool();
    const method = event.httpMethod;
    const body = parseBody(event);
    const type = body.type || event.queryStringParameters?.type;

    if (method === 'GET') {
      return json(200, { ok: true, data: await getAllData(db) });
    }

    checkAdmin(event);

    if (method === 'POST' && type === 'tour') {
      const r = await db.query(
        `INSERT INTO tours (name, emoji, start_date, end_date, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [body.name, body.emoji || '', body.start_date, body.end_date, body.sort_order || 0]
      );
      return json(200, { ok: true, id: r.rows[0].id });
    }

    if (method === 'PUT' && type === 'tour') {
      await db.query(
        `UPDATE tours SET name=$1, emoji=$2, start_date=$3, end_date=$4, sort_order=$5 WHERE id=$6`,
        [body.name, body.emoji || '', body.start_date, body.end_date, body.sort_order || 0, body.id]
      );
      return json(200, { ok: true });
    }

    if (method === 'DELETE' && type === 'tour') {
      await db.query(`DELETE FROM tours WHERE id=$1`, [body.id]);
      return json(200, { ok: true });
    }

    if (method === 'POST' && type === 'day') {
      const r = await db.query(
        `INSERT INTO days (tour_id, name, short_label, day_date, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [body.tour_id, body.name, body.short_label, body.day_date, body.sort_order || 0]
      );
      return json(200, { ok: true, id: r.rows[0].id });
    }

    if (method === 'PUT' && type === 'day') {
      await db.query(
        `UPDATE days SET tour_id=$1, name=$2, short_label=$3, day_date=$4, sort_order=$5 WHERE id=$6`,
        [body.tour_id, body.name, body.short_label, body.day_date, body.sort_order || 0, body.id]
      );
      return json(200, { ok: true });
    }

    if (method === 'DELETE' && type === 'day') {
      await db.query(`DELETE FROM days WHERE id=$1`, [body.id]);
      return json(200, { ok: true });
    }

    if (method === 'POST' && type === 'activity') {
      const r = await db.query(
        `INSERT INTO activities (day_id, time, title, small, big, needs, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [body.day_id, body.time, body.title, body.small, body.big, body.needs, body.sort_order || 0]
      );
      return json(200, { ok: true, id: r.rows[0].id });
    }

    if (method === 'PUT' && type === 'activity') {
      await db.query(
        `UPDATE activities SET day_id=$1, time=$2, title=$3, small=$4, big=$5, needs=$6, sort_order=$7 WHERE id=$8`,
        [body.day_id, body.time, body.title, body.small, body.big, body.needs, body.sort_order || 0, body.id]
      );
      return json(200, { ok: true });
    }

    if (method === 'DELETE' && type === 'activity') {
      await db.query(`DELETE FROM activities WHERE id=$1`, [body.id]);
      return json(200, { ok: true });
    }

    return json(400, { ok: false, error: 'Unsupported request.' });
  } catch (err) {
    return json(err.statusCode || 500, { ok: false, error: err.message });
  }
};
