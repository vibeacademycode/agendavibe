const { getPool, json, requireDbUrl } = require('./_db');

function toDateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function addDays(dateString, amount) {
  const d = new Date(`${toDateOnly(dateString)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

function shortLabel(dateString) {
  const months = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
  const d = new Date(`${toDateOnly(dateString)}T00:00:00Z`);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()]}`;
}

function generatedTourDates(startDate) {
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
    await db.query(
      `UPDATE days SET name=$1, short_label=$2, sort_order=$3 WHERE id=$4`,
      [`Ziua ${i + 1}`, shortLabel(rows.rows[i].day_date), i + 1, rows.rows[i].id]
    );
  }
}

async function syncTourDays(db, tourId, startDate) {
  const wantedDates = generatedTourDates(startDate);
  await db.query(`UPDATE tours SET end_date=$1 WHERE id=$2`, [generatedTourEndDate(startDate), tourId]);
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



exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  try {
    requireDbUrl();
    const db = getPool();
    await db.query(`
      CREATE TABLE IF NOT EXISTS tours (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        emoji TEXT DEFAULT '',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS days (
        id SERIAL PRIMARY KEY,
        tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        short_label TEXT NOT NULL,
        day_date DATE NOT NULL,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
        time TEXT NOT NULL,
        title TEXT NOT NULL,
        small TEXT NOT NULL,
        big TEXT NOT NULL,
        needs TEXT NOT NULL,
        group_mode TEXT DEFAULT 'separate',
        sort_order INTEGER DEFAULT 0
      );
    `);

    await db.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS group_mode TEXT DEFAULT 'separate'`);

    const count = await db.query('SELECT COUNT(*)::int AS count FROM tours');
    if (count.rows[0].count === 0) {
      const tour = await db.query(
        `INSERT INTO tours (name, emoji, start_date, end_date, sort_order)
         VALUES ($1,$2,$3,$4,1) RETURNING id`,
        ['Planeta Roboților (RoboX)', '🤖', '2025-06-02', '2025-06-13']
      );
      const tourId = tour.rows[0].id;
      const dates = generatedTourDates('2025-06-02');
      for (let i = 0; i < dates.length; i++) {
        const d = new Date(dates[i] + 'T00:00:00Z');
        const day = await db.query(
          `INSERT INTO days (tour_id, name, short_label, day_date, sort_order)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [tourId, `Ziua ${i + 1}`, shortLabel(dates[i]), dates[i], i + 1]
        );
        if (i === 0) {
          await db.query(
            `INSERT INTO activities (day_id, time, title, small, big, needs, group_mode, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,'both',1), ($1,$7,$8,$9,$10,$11,'separate',2)`,
            [
              day.rows[0].id,
              '07:30 - 09:00',
              'Sosirea și Înregistrarea Participanților',
              'Înregistrarea participanților, jocuri de cunoaștere.',
              'Înregistrarea participanților, jocuri de cunoaștere.',
              'Lista de înregistrare, spații goale pentru participanții noi și pix.',
              '09:00 - 10:30',
              'Misiunea RoboX',
              'Construim primul mini-robot și învățăm regulile de lucru în echipă.',
              'Provocare practică: strategie, construcție și testare robot.',
              'Seturi LEGO, laptop, proiector, fișe de lucru.'
            ]
          );
        }
      }
      await db.query(
        `INSERT INTO tours (name, emoji, start_date, end_date, sort_order)
         VALUES ($1,$2,$3,$4,2), ($5,$6,$7,$8,3)`,
        ['Startup Kids', '🚀', '2025-06-16', generatedTourEndDate('2025-06-16'), 'Game Lab', '🎮', '2025-06-30', generatedTourEndDate('2025-06-30')]
      );
    }

    const allTours = await db.query(`SELECT id, to_char(start_date, 'YYYY-MM-DD') AS start_date FROM tours ORDER BY start_date, id`);
    for (const tour of allTours.rows) {
      await syncTourDays(db, tour.id, tour.start_date);
    }

    return json(200, { ok: true, message: 'Database tables are ready. Tours now auto-generate 10 days.' });
  } catch (err) {
    return json(err.statusCode || 500, { ok: false, error: err.message });
  }
};
