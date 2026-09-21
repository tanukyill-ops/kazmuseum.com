import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
const catalog = JSON.parse(await readFile('public/data/catalog.json', 'utf8'));
await mkdir('.test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, hasTouch: true, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [], checks = [], failedRequests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('requestfailed', (request) => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) failedRequests.push({ url: request.url(), error: request.failure()?.errorText }); });
const step = async (name, fn) => {
  const started = Date.now();
  try { await fn(); checks.push({ name, status: 'passed', ms: Date.now() - started }); console.log(`PASS ${name} (${Date.now() - started} ms)`); }
  catch (error) {
    checks.push({ name, status: 'failed', error: error.message, ms: Date.now() - started });
    await page.screenshot({ path: `.test-results/failure-${checks.length}.png` }).catch(() => {});
    console.error(`FAIL ${name}: ${error.message}`);
    throw error;
  }
};
const countCards = async (count) => {
  await page.waitForFunction((expected) => document.querySelectorAll('[data-testid^="card-"]').length === expected, count);
};
const chooseObject = async (object) => {
  await page.getByTestId(`card-${object.id}`).click();
  await page.waitForFunction((title) => document.querySelector('.detail-panel h2')?.textContent === title, object.title.ru);
};
const quiz = async (object, correct = true) => {
  await chooseObject(object);
  await page.locator('.detail-actions').getByRole('button', { name: 'Проверь знания', exact: true }).click();
  assert.equal(await page.locator('.quiz-track i').count(), 5, 'Each quiz must have exactly five questions');
  assert.equal(object.quizQuestions.length, 5);
  for (let index = 0; index < 5; index++) {
    const question = object.quizQuestions[index];
    assert.equal(await page.locator('.quiz-question').innerText(), question.question.ru);
    assert.equal(await page.locator('.quiz-options button').count(), question.options.length);
    const answerIndex = correct ? question.correctIndex : (question.correctIndex + 1) % question.options.length;
    await page.locator('.quiz-options button').nth(answerIndex).click();
    assert.equal(await page.locator('.quiz-options button:disabled').count(), question.options.length, 'Answers lock after selection');
    assert.equal(await page.locator('.answer-feedback p').innerText(), question.explanation.ru);
    await page.locator('.answer-feedback .button').click();
  }
  assert.match(await page.locator('.quiz-result > strong').innerText(), correct ? /^5\s*\/ 5$/ : /^0\s*\/ 5$/);
  await page.locator('.quiz-result').getByRole('button', { name: 'Закрыть', exact: true }).click();
};

try {
  await step('Kazakh default and 10 catalogue entries', async () => {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await countCards(10);
    assert.equal(await page.locator('html').getAttribute('lang'), 'kk');
    assert.equal(await page.getByRole('button', { name: 'ҚАЗ', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.catalogue-header h2').innerText(), 'Музей топтамасы.');
  });
  await step('Russian and English translations', async () => {
    await page.getByRole('button', { name: 'РУС', exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    assert.equal(await page.locator('.catalogue-header h2').innerText(), 'Коллекция музея.');
    await page.getByRole('button', { name: 'ENG', exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('.catalogue-header h2').innerText(), 'Museum collection.');
    await page.getByRole('button', { name: 'РУС', exact: true }).click();
  });
  await step('Search, categories, layers and period filters', async () => {
    const search = page.locator('.search-box input');
    await search.fill('Айша'); await countCards(1); assert.equal(await page.locator('[data-testid^="card-"]').getAttribute('data-testid'), 'card-aisha-bibi');
    await search.fill('zzzxxyy'); await countCards(0); await page.locator('.no-results').waitFor();
    await search.fill(''); await countCards(10);
    await page.locator('.category-filters').getByRole('button', { name: 'Природа', exact: true }).click(); await countCards(catalog.filter((o) => o.category === 'nature').length);
    await page.locator('.category-filters').getByRole('button', { name: 'Природа', exact: true }).click(); await countCards(10);
    await page.locator('.main-nav').getByRole('button', { name: 'Слои', exact: true }).click();
    await page.locator('.layers-panel').getByLabel('Природа', { exact: true }).uncheck(); await countCards(8);
    await page.locator('.layers-panel').getByLabel('Природа', { exact: true }).check(); await countCards(10);
    await page.locator('.layers-panel').getByLabel('Историческое наследие', { exact: true }).uncheck(); await countCards(4);
    await page.locator('.layers-panel').getByLabel('Историческое наследие', { exact: true }).check(); await countCards(10);
    await page.locator('.layers-panel').getByRole('button', { name: 'Закрыть', exact: true }).click();
    await page.locator('.filter-button').click();
    await page.locator('.filter-fields').getByLabel('Исторический период', { exact: true }).selectOption('modern'); await countCards(2);
    await page.locator('.filter-fields').getByRole('button', { name: 'Сбросить', exact: true }).click(); await countCards(10);
    await page.locator('.filters-panel').getByRole('button', { name: 'Закрыть', exact: true }).click();
  });
  for (const object of catalog) await step(`Detail and GLB: ${object.id}`, async () => {
    await chooseObject(object);
    assert.equal(await page.locator('.detail-scroll > p').first().innerText(), object.description.ru);
    await page.locator('.detail-3d').click();
    await page.locator(`[data-model-loaded="${object.id}"]`).waitFor({ timeout: 35000 });
    assert.equal(await page.locator('#model-viewer-title').innerText(), object.title.ru);
    assert.equal(await page.locator('.model-viewer-canvas canvas').count(), 1);
    await page.locator('.model-viewer-back').click();
    await page.locator('.model-viewer').waitFor({ state: 'detached' });
  });
  for (const object of catalog) await step(`Five-question perfect quiz: ${object.id}`, async () => { await quiz(object); });
  await step('Lower retest keeps best score and reload preserves all 10 completions', async () => {
    await quiz(catalog[0], false);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('qazaqstan-3d-progress')));
    for (const object of catalog) assert.deepEqual(stored[object.id], { best: 5, completed: true });
    await page.reload({ waitUntil: 'domcontentloaded' }); await countCards(10);
    assert.equal(await page.locator('.test-complete').count(), 10);
    await page.getByRole('button', { name: 'РУС', exact: true }).click();
    await page.locator('.achievement-button').click();
    assert.equal(await page.locator('.progress-objects strong').allTextContents().then((values) => values.filter((s) => s === '5/5').length), 10);
  });
  await step('Personal certificate download and escaped name', async () => {
    const downloadButton = page.getByRole('button', { name: 'Скачать сертификат', exact: true });
    assert.equal(await downloadButton.isDisabled(), true);
    await page.getByRole('textbox', { name: 'Ваше имя', exact: true }).fill('E2E <Test>');
    const promise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await promise;
    await download.saveAs('.test-results/certificate.html');
    const html = await readFile('.test-results/certificate.html', 'utf8');
    assert.match(html, /E2E &lt;Test&gt;/); assert.match(html, /10 \/ 10/); assert.match(html, /50 \/ 50/);
    await page.locator('.progress-modal .modal-header').getByRole('button', { name: 'Закрыть', exact: true }).click();
  });
  await step('Guide supported question and unrelated question fallback', async () => {
    await chooseObject(catalog[0]);
    await page.locator('.guide-launcher').click();
    await page.locator('.guide-prompts').getByRole('button', { name: 'Когда появился этот объект?', exact: true }).click();
    assert.ok((await page.locator('.chat-pair .guide-answer p').last().innerText()).includes(catalog[0].period.ru));
    await page.locator('.guide-panel input').fill('Когда открывается музей?');
    await page.locator('.guide-panel').getByRole('button', { name: 'Отправить', exact: true }).click();
    assert.equal(await page.locator('.chat-pair .guide-answer p').last().innerText(), 'В фонде музея нет подтверждённой информации по этому вопросу');
    assert.equal(await page.locator('.chat-pair').last().locator('.guide-answer a').count(), 0);
    await page.locator('.guide-panel header').getByRole('button', { name: 'Закрыть', exact: true }).click();
  });
  await step('Route add, waypoint link, remove and clear', async () => {
    for (const object of catalog.slice(0, 3)) { await chooseObject(object); await page.locator('.detail-actions').getByTitle('Добавить в маршрут', { exact: true }).click(); }
    await page.locator('.main-nav').getByRole('button', { name: /Маршрут/ }).click();
    assert.equal(await page.locator('.route-content ol li').count(), 3);
    const url = new URL(await page.locator('.route-content a').getAttribute('href'));
    assert.equal(url.searchParams.get('origin'), catalog[0].coordinates.join(','));
    assert.equal(url.searchParams.get('waypoints'), catalog[1].coordinates.join(','));
    assert.equal(url.searchParams.get('destination'), catalog[2].coordinates.join(','));
    await page.locator('.route-content li').nth(1).getByTitle('Убрать из маршрута', { exact: true }).click();
    assert.equal(await page.locator('.route-content ol li').count(), 2);
    assert.equal(new URL(await page.locator('.route-content a').getAttribute('href')).searchParams.has('waypoints'), false);
    await page.locator('.route-content').getByRole('button', { name: 'Сбросить', exact: true }).click();
    await page.locator('.empty-route').waitFor();
    await page.locator('.route-panel header').getByRole('button', { name: 'Закрыть', exact: true }).click();
  });
  await step('Fullscreen targets the complete document', async () => {
    await page.locator('.detail-close').click();
    await page.locator('.map-control-stack').getByRole('button', { name: 'Полный экран', exact: true }).click();
    assert.equal(await page.evaluate(() => document.fullscreenElement === document.documentElement), true);
    await page.locator('.map-control-stack').getByRole('button', { name: 'Полный экран', exact: true }).click();
    assert.equal(await page.evaluate(() => document.fullscreenElement === null), true);
  });
  await step('Mobile 390px layout and touch orbit', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile page overflows horizontally');
    await page.screenshot({ path: '.test-results/app-mobile.png' });
    await page.getByTestId(`card-${catalog[0].id}`).click();
    await page.locator('.detail-3d').click();
    await page.locator(`[data-model-loaded="${catalog[0].id}"]`).waitFor({ timeout: 35000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile viewer overflows horizontally');
    const canvas = page.locator('.model-viewer-canvas canvas');
    const before = await canvas.evaluate((element) => element.toDataURL());
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 360 }] });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90 + i * 18, y: 360 + i * 3 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(500);
    const after = await canvas.evaluate((element) => element.toDataURL());
    assert.notEqual(after, before, 'Touch drag did not change rendered model');
    await page.screenshot({ path: '.test-results/app-mobile-model.png' });
    await page.locator('.model-viewer-back').click();
    await cdp.detach();
  });
  await step('No uncaught browser errors', async () => { assert.deepEqual(errors, []); });
} catch (error) {
  process.exitCode = 1;
} finally {
  await writeFile('.test-results/browser-report.json', JSON.stringify({ base, generated: new Date().toISOString(), checks, errors, failedRequests }, null, 2));
  await browser.close();
  console.log(`${checks.filter((c) => c.status === 'passed').length}/${checks.length} checks passed. Report: .test-results/browser-report.json`);
}
