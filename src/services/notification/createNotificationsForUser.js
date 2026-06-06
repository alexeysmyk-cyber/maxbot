import { enqueueNotification } from './notification.service.js';
import { resolveChannels } from './resolveChannels.js';

/**
 * Создаёт уведомления для одного пользователя (fan-out)
 */
export async function createNotificationsForUser({
  user,
  patient,
  key,
  payload,
  externalIdBase
}) {

 // const channels = resolveChannels(user, patient, key, data);

const channels = resolveChannels(user, patient, key );

 console.log('🧪 TEST CHANNEL RESOLVE:', {
  userId: user.id,
  vk_id: user.vk_id,
  patientEmail: patient?.email,
  key,
  channels
});

  console.log('📡 CHANNELS:', channels);

  if (!channels.length) {
    console.log('🚫 NO CHANNELS');
    return;
  }

  for (const channel of channels) {

    const externalId = `${externalIdBase}_${channel}`;

    await enqueueNotification({
      userId: user.id,
      type: key,
      channel,
      payload,
      externalId
    });
  }
}