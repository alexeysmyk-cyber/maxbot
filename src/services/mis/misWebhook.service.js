import { resolvePatient } from './patient.resolver.js';
import { processEvent } from './event.processor.js';





export async function handleMisWebhook(req, bot) {

  
console.log('🔥 WEBHOOK HIT');
console.log('📦 RAW BODY:', req.body);

  const secret =
    req.query?.secret ||
    req.headers['x-webhook-secret'] ||
    req.body?.secret;
    
  if (secret !== process.env.MIS_WEBHOOK_SECRET) {
    console.log('🔥 Wrong secret');
    return;
  }

  const event = req.body.event;

  console.log('📦 EVENT:', event);

  let data = req.body.data || {};

  for (const key in req.body) {
    const match = key.match(/^data\[(.+)\]$/);
    if (match) {
      const field = match[1];

      if (!data[field] || data[field].length < req.body[key].length) {
        data[field] = req.body[key];
      }
    }
  }

  const { patient, patientUser } = await resolvePatient(data);

  if (!patientUser) return;

  await processEvent({
    event,
    data,
    patient,
    patientUser
  });
}