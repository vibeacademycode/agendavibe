import { neon } from '@netlify/neon';

const ADMIN_PIN = process.env.ADMIN_PIN || '629122';
const sql = neon();

const json = (statusCode, data) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  },
  body: JSON.stringify(data)
});

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS tours (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      emoji TEXT DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS days (
      id SERIAL PRIMARY KEY,
      tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      short_label TEXT NOT NULL,
      date TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
      time TEXT NOT NULL,
      activity TEXT NOT NULL,
      small TEXT NOT NULL,
      big TEXT NOT NULL,
      needs TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `;

  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM tours`;
  if (count === 0) await seedData();
}

async function seedData() {
  const [tour] = await sql`
    INSERT INTO tours (title, emoji, start_date, end_date, sort_order)
    VALUES ('Planeta Roboților (RoboX)', '🤖', '2025-06-02', '2025-06-13', 1)
    RETURNING *
  `;

  const baseDays = [
    ['Ziua 1', '02 iun', '02-06-2025'], ['Ziua 2', '03 iun', '03-06-2025'],
    ['Ziua 3', '04 iun', '04-06-2025'], ['Ziua 4', '05 iun', '05-06-2025'],
    ['Ziua 5', '06 iun', '06-06-2025'], ['Ziua 6', '09 iun', '09-06-2025'],
    ['Ziua 7', '10 iun', '10-06-2025'], ['Ziua 8', '11 iun', '11-06-2025'],
    ['Ziua 9', '12 iun', '12-06-2025'], ['Ziua 10', '13 iun', '13-06-2025']
  ];

  let firstDayId = null;
  for (let i = 0; i < baseDays.length; i++) {
    const [day] = await sql`
      INSERT INTO days (tour_id, name, short_label, date, sort_order)
      VALUES (${tour.id}, ${baseDays[i][0]}, ${baseDays[i][1]}, ${baseDays[i][2]}, ${i + 1})
      RETURNING id
    `;
    if (i === 0) firstDayId = day.id;
  }

  await sql`
    INSERT INTO activities (day_id, time, activity, small, big, needs, sort_order)
    VALUES
    (${firstDayId}, '07:30 - 09:00', 'Sosirea și Înregistrarea Participanților', 'Înregistrarea participanților, jocuri de cunoaștere.', 'Înregistrarea participanților, jocuri de cunoaștere.', 'Lista de înregistrare, spații goale pentru participanții noi și pix.', 1),
    (${firstDayId}, '09:00 - 10:30', 'Misiunea RoboX', 'Construim primul mini-robot și învățăm regulile de lucru în echipă.', 'Provocare practică: strategie, construcție și testare robot.', 'Seturi LEGO, laptop, proiector, fișe de lucru.', 2)
  `;

  await sql`
    INSERT INTO tours (title, emoji, start_date, end_date, sort_order)
    VALUES ('Startup Kids', '🚀', '2025-06-16', '2025-06-27', 2),
           ('Game Lab', '🎮', '2025-06-30', '2025-07-11', 3)
  `;
}

async function getData() {
  await ensureSchema();
  const tours = await sql`SELECT * FROM tours ORDER BY sort_order, id`;
  const days = await sql`SELECT * FROM days ORDER BY sort_order, id`;
  const activities = await sql`SELECT * FROM activities ORDER BY sort_order, id`;
  return tours.map(tour => ({
    ...tour,
    days: days.filter(day => day.tour_id === tour.id).map(day => ({
      ...day,
      activities: activities.filter(activity => activity.day_id === day.id)
    }))
  }));
}

function requireAdmin(body) {
  if (!body || body.pin !== ADMIN_PIN) {
    const error = new Error('PIN greșit');
    error.statusCode = 401;
    throw error;
  }
}

async function parseBody(event) {
  return event.body ? JSON.parse(event.body) : {};
}

export const handler = async (event) => {
  try {
    await ensureSchema();

    if (event.httpMethod === 'GET') {
      return json(200, { tours: await getData() });
    }

    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = await parseBody(event);
    requireAdmin(body);
    const action = body.action;

    if (action === 'saveTour') {
      const tour = body.tour || {};
      if (tour.id) {
        await sql`UPDATE tours SET title=${tour.title}, emoji=${tour.emoji || ''}, start_date=${tour.start_date}, end_date=${tour.end_date}, sort_order=${Number(tour.sort_order || 0)} WHERE id=${Number(tour.id)}`;
      } else {
        await sql`INSERT INTO tours (title, emoji, start_date, end_date, sort_order) VALUES (${tour.title}, ${tour.emoji || ''}, ${tour.start_date}, ${tour.end_date}, ${Number(tour.sort_order || 0)})`;
      }
    }

    if (action === 'deleteTour') {
      await sql`DELETE FROM tours WHERE id=${Number(body.id)}`;
    }

    if (action === 'saveDay') {
      const day = body.day || {};
      if (day.id) {
        await sql`UPDATE days SET tour_id=${Number(day.tour_id)}, name=${day.name}, short_label=${day.short_label}, date=${day.date}, sort_order=${Number(day.sort_order || 0)} WHERE id=${Number(day.id)}`;
      } else {
        await sql`INSERT INTO days (tour_id, name, short_label, date, sort_order) VALUES (${Number(day.tour_id)}, ${day.name}, ${day.short_label}, ${day.date}, ${Number(day.sort_order || 0)})`;
      }
    }

    if (action === 'deleteDay') {
      await sql`DELETE FROM days WHERE id=${Number(body.id)}`;
    }

    if (action === 'saveActivity') {
      const item = body.activity || {};
      if (item.id) {
        await sql`UPDATE activities SET day_id=${Number(item.day_id)}, time=${item.time}, activity=${item.activity}, small=${item.small}, big=${item.big}, needs=${item.needs}, sort_order=${Number(item.sort_order || 0)} WHERE id=${Number(item.id)}`;
      } else {
        await sql`INSERT INTO activities (day_id, time, activity, small, big, needs, sort_order) VALUES (${Number(item.day_id)}, ${item.time}, ${item.activity}, ${item.small}, ${item.big}, ${item.needs}, ${Number(item.sort_order || 0)})`;
      }
    }

    if (action === 'deleteActivity') {
      await sql`DELETE FROM activities WHERE id=${Number(body.id)}`;
    }

    return json(200, { ok: true, tours: await getData() });
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || 'Server error' });
  }
};
