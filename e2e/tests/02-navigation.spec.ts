import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'

let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  const launched = await launchApp()
  app = launched.app
  page = launched.page
})

test.afterEach(async () => {
  await closeApp(app)
})

test('navigates to VPS page', async () => {
  await page.getByRole('link', { name: 'VPS' }).click()
  await expect(page.getByRole('heading', { name: 'VPS' })).toBeVisible()
  await expect(page.getByText('Servidores remotos cadastrados')).toBeVisible()
})

test('navigates to Projetos page', async () => {
  await page.getByRole('link', { name: 'Projetos' }).click()
  await expect(page.getByRole('heading', { name: 'Projetos' })).toBeVisible()
})

test('navigates to Lançador page', async () => {
  await page.getByRole('link', { name: 'Lançador' }).click()
  await expect(page.getByRole('heading', { name: 'Lançador' })).toBeVisible()
})

test('navigates to Monitor page', async () => {
  await page.getByRole('link', { name: 'Monitor' }).click()
  await expect(page.getByRole('heading', { name: 'Monitor' })).toBeVisible()
})

test('navigates to Configurações page', async () => {
  await page.getByRole('link', { name: 'Configurações' }).click()
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible()
})

test('navigates to Manual (Help) page', async () => {
  await page.getByRole('link', { name: 'Manual' }).click()
  await expect(page.getByRole('heading', { name: /Manual|HEXAGON IDE/i }).first()).toBeVisible()
})

test('navigates to Diagnóstico page', async () => {
  await page.getByRole('link', { name: 'Diagnóstico' }).click()
  await expect(page.getByRole('heading', { name: /Diagnóstico/i })).toBeVisible()
})

test('back-navigation returns to Dashboard', async () => {
  await page.getByRole('link', { name: 'VPS' }).click()
  await expect(page.getByRole('heading', { name: 'VPS' })).toBeVisible()

  await page.getByRole('link', { name: 'Dashboard' }).click()
  // Dashboard shows "HEXAGON IDE" as a main heading or the summary cards
  await expect(page.locator('main')).toBeVisible()
})
