import { prisma } from '../db/prisma.js';

export async function getTemplates(req, res) {
  const templates = await prisma.notificationTemplate.findMany();
  res.json(templates);
}

export async function updateTemplate(req, res) {
  const { id, text } = req.body;

  const updated = await prisma.notificationTemplate.update({
    where: { id },
    data: { text }
  });

  res.json(updated);
}