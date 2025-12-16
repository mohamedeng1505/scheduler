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
      JSON.stringify({ slots: [], tasks: [], savedSlotLists: [] }, null, 2),
      'utf8'
    );
  }
}

async function readData() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  const parsed = JSON.parse(
    raw.toString() || '{"slots":[],"tasks":[],"savedSlotLists":[]}'
  );
  return {
    slots: parsed.slots || [],
    tasks: parsed.tasks || [],
    savedSlotLists: parsed.savedSlotLists || []
  };
}

async function writeData(data) {
  await ensureDataFile();
  await fs.writeFile(
    DATA_PATH,
    JSON.stringify(
      {
        slots: data.slots || [],
        tasks: data.tasks || [],
        savedSlotLists: data.savedSlotLists || []
      },
      null,
      2
    ),
    'utf8'
  );
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
    const existing = await readData();
    await writeData({ ...existing, slots, tasks });
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Failed to write data file', err);
    res.status(500).json({ message: 'Failed to save data' });
  }
});

app.get('/api/slot-lists', async (_req, res) => {
  try {
    const data = await readData();
    res.json({ savedSlotLists: data.savedSlotLists || [] });
  } catch (err) {
    console.error('Failed to read saved slot lists', err);
    res.status(500).json({ message: 'Failed to load saved slot lists' });
  }
});

app.post('/api/slot-lists', async (req, res) => {
  const { name, slots } = req.body || {};

  if (!name || typeof name !== 'string' || !Array.isArray(slots)) {
    return res.status(400).json({ message: 'Invalid payload' });
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return res.status(400).json({ message: 'List name is required' });
  }

  try {
    const data = await readData();
    const newList = {
      id: `slotlist-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      name: trimmed,
      slots
    };
    const updatedLists = [...(data.savedSlotLists || []), newList];
    await writeData({ ...data, savedSlotLists: updatedLists });
    res.json(newList);
  } catch (err) {
    console.error('Failed to save slot list', err);
    res.status(500).json({ message: 'Failed to save slot list' });
  }
});

app.delete('/api/slot-lists/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'List id is required' });
  }

  try {
    const data = await readData();
    const nextLists = (data.savedSlotLists || []).filter((list) => list.id !== id);
    if (nextLists.length === (data.savedSlotLists || []).length) {
      return res.status(404).json({ message: 'List not found' });
    }
    await writeData({ ...data, savedSlotLists: nextLists });
    res.json({ status: 'deleted', id });
  } catch (err) {
    console.error('Failed to delete slot list', err);
    res.status(500).json({ message: 'Failed to delete slot list' });
  }
});

app.patch('/api/slot-lists/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body || {};

  if (!id) {
    return res.status(400).json({ message: 'List id is required' });
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'List name is required' });
  }

  try {
    const data = await readData();
    const lists = data.savedSlotLists || [];
    const idx = lists.findIndex((l) => l.id === id);
    if (idx === -1) {
      return res.status(404).json({ message: 'List not found' });
    }
    const updated = { ...lists[idx], name: name.trim() };
    const nextLists = [...lists];
    nextLists[idx] = updated;
    await writeData({ ...data, savedSlotLists: nextLists });
    res.json(updated);
  } catch (err) {
    console.error('Failed to update slot list', err);
    res.status(500).json({ message: 'Failed to update slot list' });
  }
});

app.listen(PORT, () => {
  console.log(`Data server running on http://localhost:${PORT}`);
});
