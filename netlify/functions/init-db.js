const { getPool, json, requireDbUrl } = require('./_db');

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
        sort_order INTEGER DEFAULT 0
      );
    `);

    const count = await db.query('SELECT COUNT(*)::int AS count FROM tours');
    if (count.rows[0].count === 0) {
      const tour = await db.query(
        `INSERT INTO tours (name, emoji, start_date, end_date, sort_order)
         VALUES ($1,$2,$3,$4,1) RETURNING id`,
        ['Planeta Roboților (RoboX)', '🤖', '2025-06-02', '2025-06-13']
      );
      const tourId = tour.rows[0].id;
      const dates = ['2025-06-02','2025-06-03','2025-06-04','2025-06-05','2025-06-06','2025-06-09','2025-06-10','2025-06-11','2025-06-12','2025-06-13'];
      const ro = ['iun','iun','iun','iun','iun','iun','iun','iun','iun','iun'];
      for (let i = 0; i < dates.length; i++) {
        const d = new Date(dates[i] + 'T00:00:00Z');
        const day = await db.query(
          `INSERT INTO days (tour_id, name, short_label, day_date, sort_order)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [tourId, `Ziua ${i + 1}`, `${String(d.getUTCDate()).padStart(2,'0')} ${ro[i]}`, dates[i], i + 1]
        );
        if (i === 0) {
          await db.query(
            `INSERT INTO activities (day_id, time, title, small, big, needs, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,1), ($1,$7,$8,$9,$10,$11,2)`,
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
        ['Startup Kids', '🚀', '2025-06-16', '2025-06-27', 'Game Lab', '🎮', '2025-06-30', '2025-07-11']
      );
    }

    return json(200, { ok: true, message: 'Database tables are ready.' });
  } catch (err) {
    return json(err.statusCode || 500, { ok: false, error: err.message });
  }
};
