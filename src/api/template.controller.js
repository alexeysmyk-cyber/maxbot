import { prisma } from '../db/prisma.js';

export async function getTemplates(req, res) {
  const templates = await prisma.notificationTemplate.findMany();
  res.json(templates);
}

export async function updateTemplate(req, res) {
  try {
    const { id, text, subject } = req.body;

    const updated = await prisma.notificationTemplate.update({
      where: { id },
      data: { text, subject }
    });

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'UPDATE_ERROR' });
  }
}

export async function createTemplate(req, res) {
  try {
    const { key, channel, text, subject } = req.body;

    const template = await prisma.notificationTemplate.create({
      data: {
        key,
        channel,
        text,
        subject
      }
    });

    res.json(template);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'CREATE_ERROR' });
  }
}