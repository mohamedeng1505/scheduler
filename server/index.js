const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_PATH = path.join(DATA_DIR, 'db.json');

app.use(cors());
app.use(express.json());

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.writeFile(
      DATA_PATH,
      JSON.stringify({ slots: [], tasks: [] }, null, 2),
      'utf8'
    );
  }
}

async function readData() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  return JSON.parse(raw.toString() || '{"slots":[],"tasks":[]}');
}

async function writeData(data) {
  await ensureDataFile();
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

app.get('/api/data', async (_req, res) => {
  try {
    const data = await readData();
    res.json(data);
  } catch (err) {
    console.error('Failed to read data file', err);
    res.status(500).json({ message: 'Failed to load data' });
  }
});

app.post('/api/sync', async (req, res) => {
  const { slots, tasks } = req.body || {};
  if (!Array.isArray(slots) || !Array.isArray(tasks)) {
    return res.status(400).json({ message: 'Invalid payload' });
  }

  try {
    await writeData({ slots, tasks });
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Failed to write data file', err);
    res.status(500).json({ message: 'Failed to save data' });
  }
});

app.listen(PORT, () => {
  console.log(`Data server running on http://localhost:${PORT}`);
});
