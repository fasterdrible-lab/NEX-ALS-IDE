import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'

let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  const launched = await launchApp()
  app = launched.app
  page = launched.page
  await page.getByRole('link', { name: 'VPS' }).click()
  await expect(page.getByRole('heading', { name: 'VPS' })).toBeVisible()
})

test.afterEach(async () => {
  await closeApp(app)
})

test('shows empty state when no VPS exists', async () => {
  await expect(page.getByText('Nenhuma VPS cadastrada ainda')).toBeVisible()
})

test('opens Nova VPS modal via empty-state button', async () => {
  await page.getByRole('button', { name: /Adicionar VPS/i }).click()
  await expect(page.getByRole('heading', { name: 'Nova VPS' })).toBeVisible()
})

test('opens Nova VPS modal via header button', async () => {
  await page.getByRole('button', { name: /Nova VPS/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Nova VPS' })).toBeVisible()
})

test('closes modal with Cancelar button', async () => {
  await page.getByRole('button', { name: /Nova VPS/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Nova VPS' })).toBeVisible()

  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('heading', { name: 'Nova VPS' })).not.toBeVisible()
})

test('Salvar button is disabled when required fields are empty', async () => {
  await page.getByRole('button', { name: /Nova VPS/i }).first().click()
  const saveBtn = page.getByRole('button', { name: 'Salvar' })
  await expect(saveBtn).toBeDisabled()
})

test('creates a new VPS and shows it in the list', async () => {
  await page.getByRole('button', { name: /Nova VPS/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Nova VPS' })).toBeVisible()

  await page.getByPlaceholder('ex: VPS Principal').fill('VPS E2E Teste')
  await page.getByPlaceholder('204.168.180.25').fill('192.168.1.100')
  await page.getByPlaceholder('root').fill('ubuntu')

  const saveBtn = page.getByRole('button', { name: 'Salvar' })
  await expect(saveBtn).toBeEnabled()
  await saveBtn.click()

  // Modal closes and list shows the new entry
  await expect(page.getByRole('heading', { name: 'Nova VPS' })).not.toBeVisible()
  await expect(page.getByText('VPS E2E Teste')).toBeVisible()
  await expect(page.getByText('ubuntu@192.168.1.100:22')).toBeVisible()
})

test('VPS row shows Testar connection button', async () => {
  // Create a VPS first
  await page.getByRole('button', { name: /Nova VPS/i }).first().click()
  await page.getByPlaceholder('ex: VPS Principal').fill('VPS Teste')
  await page.getByPlaceholder('204.168.180.25').fill('10.0.0.1')
  await page.getByPlaceholder('root').fill('root')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('VPS Teste')).toBeVisible()

  await expect(page.getByRole('button', { name: /Testar/i })).toBeVisible()
})

test('edits an existing VPS', async () => {
  // Create
  await page.getByRole('button', { name: /Nova VPS/i }).first().click()
  await page.getByPlaceholder('ex: VPS Principal').fill('VPS Original')
  await page.getByPlaceholder('204.168.180.25').fill('1.2.3.4')
  await page.getByPlaceholder('root').fill('admin')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('VPS Original')).toBeVisible()

  // Edit
  await page.locator('button[title], button').filter({ hasText: '' }).last() // pencil button - use more specific locator
  // Click the edit (pencil) button for that VPS
  const editBtn = page.locator('.card').filter({ hasText: 'VPS Original' }).getByRole('button').nth(1)
  await editBtn.click()

  await expect(page.getByRole('heading', { name: 'Editar VPS' })).toBeVisible()
  await page.getByPlaceholder('ex: VPS Principal').fill('VPS Renomeada')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.getByText('VPS Renomeada')).toBeVisible()
  await expect(page.getByText('VPS Original')).not.toBeVisible()
})
