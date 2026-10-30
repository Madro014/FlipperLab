import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Juegos', exact: true}).click();
});

test('runner learns a controller key, jumps, pauses and resumes', async ({page}) => {
  await page.getByRole('button', {name: 'Asignar botón', exact: true}).click();
  await page.keyboard.press('PageDown');
  await expect(page.locator('.runner-input')).toContainText('Av. pág.');
  await expect(page.locator('.runner-stage')).toBeFocused();
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('runner-status')).toHaveText('En carrera');
  await expect(page.getByTestId('runner-character')).not.toHaveAttribute('transform', 'translate(110,198)');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('runner-status')).toHaveText('En pausa');
  const position = await page.getByTestId('runner-character').getAttribute('transform');
  await page.waitForTimeout(200);
  await expect(page.getByTestId('runner-character')).toHaveAttribute('transform', position);
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('runner-status')).toHaveText('En carrera');
  await page.getByRole('button', {name: 'Mi dispositivo', exact: true}).click();
  await page.keyboard.press('PageDown');
  await page.getByRole('button', {name: 'Juegos', exact: true}).click();
  await expect(page.getByTestId('runner-status')).toHaveText('En pausa');
});

test('runner ignores held keys, collides, restarts and supports the jump button', async ({page}) => {
  await page.locator('.runner-stage').focus();
  await page.keyboard.down('Space');
  await page.keyboard.down('Space');
  await expect(page.locator('.runner-input')).toContainText('1 pulsaciones');
  await page.keyboard.up('Space');
  await expect(page.getByTestId('runner-status')).toHaveText('Fin de la partida', {timeout: 7000});
  await page.keyboard.press('Space');
  await expect(page.getByTestId('runner-status')).toHaveText('En carrera');
  await page.waitForTimeout(800);
  await page.getByRole('button', {name: 'Saltar', exact: true}).click();
  await expect(page.getByTestId('runner-character')).not.toHaveAttribute('transform', 'translate(110,198)');
  await page.getByRole('button', {name: 'Pausar', exact: true}).click();
  await expect(page.getByTestId('runner-status')).toHaveText('En pausa');
  await page.getByRole('button', {name: 'Reiniciar', exact: true}).click();
  await expect(page.getByTestId('runner-status')).toHaveText('Listo para jugar');
  await expect(page.locator('.games-stats strong').first()).toHaveText('0');
});

test('runner fits phone width and cancels button assignment', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.getByRole('button', {name: 'Asignar botón', exact: true}).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.runner-capture')).toHaveCount(0);
  await expect(page.getByText('Asignación cancelada.', {exact: false})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: 'test-results/runner-mobile.png', fullPage: true});
  await page.setViewportSize({width: 1440, height: 1050});
  await page.screenshot({path: 'test-results/runner-desktop.png', fullPage: true});
});

test('native games guide searches the observed inventory and pauses the runner', async ({page}) => {
  await page.getByRole('button', {name: 'Empezar partida', exact: true}).click();
  await page.getByRole('button', {name: 'En el Flipper · Games', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Tu consola de bolsillo.'})).toBeVisible();
  await expect(page.locator('.native-file-list li')).toHaveCount(42);
  await page.getByRole('textbox', {name: 'Buscar juegos del Flipper'}).fill('tetris');
  await expect(page.locator('.native-file-list li')).toHaveCount(1);
  await expect(page.locator('.native-file-list')).toContainText('tetris.fap');
  await page.getByRole('textbox', {name: 'Buscar juegos del Flipper'}).fill('no-such-game');
  await expect(page.getByText('No hay coincidencias. Prueba otro nombre.')).toBeVisible();
  await page.getByRole('textbox', {name: 'Buscar juegos del Flipper'}).fill('');
  await page.setViewportSize({width: 390, height: 844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/native-games-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1050});
  await page.screenshot({path:'test-results/native-games-desktop.png',fullPage:true});
  await page.getByRole('button', {name: 'En el computador · Flipper como mando', exact: true}).click();
  await expect(page.getByTestId('runner-status')).toHaveText('En pausa');
});
