const { getPool, json, requireDbUrl, checkAdmin } = require('./_db');

function parseBody(event) {
  try { return event.body ? JSON.parse(event.body) : {}; }
  catch { return {}; }
}

function toDateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function shortLabel(dateString) {
  const months = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
  const d = new Date(`${toDateOnly(dateString)}T00:00:00Z`);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()]}`;
}

function addDays(dateString, amount) {
  const d = new Date(`${toDateOnly(dateString)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

function generatedTourDates(startDate) {
  // 10 camp days: first 5 days, skip 2 free days, then 5 more days.
  return [0, 1, 2, 3, 4, 7, 8, 9, 10, 11].map(offset => addDays(startDate, offset));
}

function generatedTourEndDate(startDate) {
  return addDays(startDate, 11);
}

async function renumberDays(db, tourId) {
  const rows = await db.query(
    `SELECT id, to_char(day_date, 'YYYY-MM-DD') AS day_date
     FROM days
     WHERE tour_id=$1
     ORDER BY day_date, id`,
    [tourId]
  );
  for (let i = 0; i < rows.rows.length; i++) {
    const row = rows.rows[i];
    await db.query(
      `UPDATE days SET name=$1, short_label=$2, sort_order=$3 WHERE id=$4`,
      [`Ziua ${i + 1}`, shortLabel(row.day_date), i + 1, row.id]
    );
  }
}

async function syncTourDays(db, tourId) {
  const tour = await db.query(
    `SELECT to_char(start_date, 'YYYY-MM-DD') AS start_date FROM tours WHERE id=$1`,
    [tourId]
  );
  if (!tour.rows.length) return;

  const wantedDates = generatedTourDates(tour.rows[0].start_date);
  const generatedEndDate = generatedTourEndDate(tour.rows[0].start_date);

  await db.query(`UPDATE tours SET end_date=$1 WHERE id=$2`, [generatedEndDate, tourId]);

  for (const dayDate of wantedDates) {
    await db.query(
      `INSERT INTO days (tour_id, name, short_label, day_date, sort_order)
       SELECT $1, '', '', $2, 0
       WHERE NOT EXISTS (SELECT 1 FROM days WHERE tour_id=$1 AND day_date=$2)`,
      [tourId, dayDate]
    );
  }

  await db.query(
    `DELETE FROM days
     WHERE tour_id=$1
       AND day_date <> ALL($2::date[])
       AND NOT EXISTS (SELECT 1 FROM activities WHERE activities.day_id = days.id)`,
    [tourId, wantedDates]
  );

  await renumberDays(db, tourId);
}

async function getAllData(db) {
  const tours = await db.query(`SELECT id, name, emoji, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, sort_order FROM tours ORDER BY start_date, end_date, id`);
  const days = await db.query(`SELECT id, tour_id, name, short_label, to_char(day_date, 'YYYY-MM-DD') AS day_date, sort_order FROM days ORDER BY day_date, id`);
  await db.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS group_mode TEXT DEFAULT 'separate'`);
  const activities = await db.query(`SELECT id, day_id, time, title, small, big, needs, COALESCE(group_mode, 'separate') AS group_mode, sort_order FROM activities ORDER BY time, id`);
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
        `INSERT INTO tours (name, emoji, start_date, end_date, sort_order) VALUES ($1,$2,$3,$4,0) RETURNING id`,
        [body.name, body.emoji || '', body.start_date, generatedTourEndDate(body.start_date)]
      );
      await syncTourDays(db, r.rows[0].id);
      return json(200, { ok: true, id: r.rows[0].id });
    }

    if (method === 'PUT' && type === 'tour') {
      await db.query(
        `UPDATE tours SET name=$1, emoji=$2, start_date=$3, end_date=$4 WHERE id=$5`,
        [body.name, body.emoji || '', body.start_date, generatedTourEndDate(body.start_date), body.id]
      );
      await syncTourDays(db, body.id);
      return json(200, { ok: true });
    }

    if (method === 'DELETE' && type === 'tour') {
      await db.query(`DELETE FROM tours WHERE id=$1`, [body.id]);
      return json(200, { ok: true });
    }

    if (method === 'POST' && type === 'day') {
      const r = await db.query(
        `INSERT INTO days (tour_id, name, short_label, day_date, sort_order) VALUES ($1,'','',$2,0) RETURNING id`,
        [body.tour_id, body.day_date]
      );
      await renumberDays(db, body.tour_id);
      return json(200, { ok: true, id: r.rows[0].id });
    }

    if (method === 'PUT' && type === 'day') {
      await db.query(
        `UPDATE days SET tour_id=$1, day_date=$2 WHERE id=$3`,
        [body.tour_id, body.day_date, body.id]
      );
      await renumberDays(db, body.tour_id);
      return json(200, { ok: true });
    }

    if (method === 'DELETE' && type === 'day') {
      const old = await db.query(`SELECT tour_id FROM days WHERE id=$1`, [body.id]);
      await db.query(`DELETE FROM days WHERE id=$1`, [body.id]);
      if (old.rows[0]) await renumberDays(db, old.rows[0].tour_id);
      return json(200, { ok: true });
    }

    if (method === 'POST' && type === 'duplicate_day') {
      const sourceDayId = Number(body.source_day_id);
      const targetDayIds = Array.isArray(body.target_day_ids) ? body.target_day_ids.map(Number).filter(Boolean) : [];
      const replace = body.replace !== false;

      if (!sourceDayId || !targetDayIds.length) {
        return json(400, { ok: false, error: 'Choose source day and at least one target day.' });
      }

      const sourceActivities = await db.query(
        `SELECT time, title, small, big, needs, COALESCE(group_mode, 'separate') AS group_mode, sort_order
         FROM activities
         WHERE day_id=$1
         ORDER BY time, id`,
        [sourceDayId]
      );

      if (!sourceActivities.rows.length) {
        return json(400, { ok: false, error: 'Source day has no activities to duplicate.' });
      }

      let copied = 0;
      for (const targetDayId of targetDayIds) {
        if (!targetDayId || targetDayId === sourceDayId) continue;
        if (replace) await db.query(`DELETE FROM activities WHERE day_id=$1`, [targetDayId]);
        for (const a of sourceActivities.rows) {
          await db.query(
            `INSERT INTO activities (day_id, time, title, small, big, needs, group_mode, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [targetDayId, a.time, a.title, a.small, a.big, a.needs, a.group_mode || 'separate', a.sort_order || 0]
          );
          copied++;
        }
      }

      return json(200, { ok: true, copied });
    }

    if (method === 'POST' && type === 'activity') {
      const r = await db.query(
        `INSERT INTO activities (day_id, time, title, small, big, needs, group_mode, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [body.day_id, body.time, body.title, body.small, body.big, body.needs, body.group_mode || 'separate', body.sort_order || 0]
      );
      return json(200, { ok: true, id: r.rows[0].id });
    }

    if (method === 'PUT' && type === 'activity') {
      await db.query(
        `UPDATE activities SET day_id=$1, time=$2, title=$3, small=$4, big=$5, needs=$6, group_mode=$7, sort_order=$8 WHERE id=$9`,
        [body.day_id, body.time, body.title, body.small, body.big, body.needs, body.group_mode || 'separate', body.sort_order || 0, body.id]
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
