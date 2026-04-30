export async function sendWithRetry(fn) {
  let delay = 2000; // старт 2 сек

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await fn();
    } catch (e) {
      console.error(`❌ MAX ERROR [${attempt}]:`, e.message);

      // если последняя попытка
      if (attempt === 5) {
        console.error('💀 FINAL FAIL (message not sent)');
        return null; // ❗ НЕ КИДАЕМ ошибку
      }

      console.log(`⏳ retry через ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));

      delay *= 2; // 2 → 4 → 8 → 16
    }
  }
}