import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'

let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  const launched = await launchApp()
  app = launched.app
  page = launched.page
  await page.getByRole('link', { name: 'Configurações' }).click()
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible()
})

test.afterEach(async () => {
  await closeApp(app)
})

test('shows Notificações section with toggle', async () => {
  await expect(page.getByText('Notificações')).toBeVisible()
  await expect(page.getByRole('switch')).toBeVisible()
})

test('notifications toggle starts as enabled', async () => {
  const toggle = page.getByRole('switch')
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
})

test('can toggle notifications off and back on', async () => {
  const toggle = page.getByRole('switch')
  await expect(toggle).toHaveAttribute('aria-checked', 'true')

  // Disable
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')

  // Re-enable
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
})

test('shows Provedores de IA section', async () => {
  await expect(page.getByText('Provedores de IA')).toBeVisible()
})

test('shows Anthropic as a provider option', async () => {
  await expect(page.getByText('Anthropic')).toBeVisible()
})

test('shows Backup e Restauração section', async () => {
  await expect(page.getByText(/Backup|Restaura/i).first()).toBeVisible()
})

test('shows Exportar Configurações button', async () => {
  await expect(page.getByRole('button', { name: /Exportar/i })).toBeVisible()
})

test('shows Importar Configurações button', async () => {
  await expect(page.getByRole('button', { name: /Importar/i })).toBeVisible()
})
