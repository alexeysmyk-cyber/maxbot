



export function formatDateRu(dateTime) {
  if (!dateTime) return '';

  const [datePart] = dateTime.split(' ');
  const [day, month, year] = datePart.split('.');

  const dateObj = new Date(`${year}-${month}-${day}`);

  const weekdays = [
    'воскресенье','понедельник','вторник',
    'среда','четверг','пятница','суббота'
  ];

  const months = [
    'января','февраля','марта','апреля','мая','июня',
    'июля','августа','сентября','октября','ноября','декабря'
  ];

  return ` ${day} ${months[month - 1]} ${year}, ${weekdays[dateObj.getDay()]}`;
}

export function formatTime(dateTime) {
  if (!dateTime) return '';
  return dateTime.split(' ')[1] || '';
}

export function buildTemplateData({ data, safeAppointment }) {

  const rawStart = safeAppointment?.time_start || data.time_start || '';
const rawEnd = data.time_end || safeAppointment?.time_end || '';

// 🔥 ДОБАВЬ ЭТО
const rawOldStart =
  data.old_time_start ||
  data.time_start_old ||
  data.old_time ||
  '';

const result = {
  patient_name:
    safeAppointment?.patient_name ||
    safeAppointment?.patient ||
    data.patient_name ||
    '',

  doctor_name: safeAppointment?.doctor || data.doctor || '',

  date: formatDateRu(rawStart),
  time_start: formatTime(rawStart),
  time_end: formatTime(rawEnd),

  cabinet: safeAppointment?.room || data.room || '',
  clinic: safeAppointment?.clinic || data.clinic || '',
  new_doctor: safeAppointment?.doctor || data.doctor || '',

  phone: data.patient_phone || '',
  email: data.patient_email || '',

  // 🔥 ИСПРАВЛЕНО
  old_date: formatDateRu(rawOldStart),
  new_date: formatDateRu(rawStart),

  old_time: formatTime(rawOldStart),
  new_time: formatTime(rawStart),

  old_doctor:
    data.old_doctor ||
    safeAppointment?.doctor ||
    '',

  review_link: data.review_link || '',
  author_name: data.author_name || '',
  status: data.status || ''
};
  console.log('🧪 TEMPLATE DATA:', result);

  return result;
}