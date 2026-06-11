import { test, expect, ElectronApplication, Page } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'

let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  const launched = await launchApp()
  app = launched.app
  page = launched.page
  // Squad is fullscreen (no Layout sidebar) — navigate via sidebar button
  await page.getByRole('button', { name: 'SQUAD' }).click()
  // Wait for the Squad left-panel heading to confirm navigation
  await expect(page.locator('span').filter({ hasText: 'Squad' }).first()).toBeVisible()
})

test.afterEach(async () => {
  await closeApp(app)
})

test('Squad page loads with left panel heading', async () => {
  await expect(page.locator('span').filter({ hasText: 'Squad' }).first()).toBeVisible()
})

test('left panel lists all 8 agents', async () => {
  const agents = ['Jarvis', 'Friday', 'Fury', 'Shuri', 'Pepper', 'Vision', 'Requis', 'Tester']
  for (const name of agents) {
    // Each agent is a button in the left panel
    await expect(page.locator('p').filter({ hasText: name }).first()).toBeVisible()
  }
})

test('default active agent is Jarvis — chat header shows Jarvis', async () => {
  // Chat header renders an h2 with the active agent label
  await expect(page.locator('h2').filter({ hasText: 'Jarvis' })).toBeVisible()
})

test('switching agent updates chat header', async () => {
  // Click Friday agent button in left panel
  await page.locator('p.text-xs.font-semibold').filter({ hasText: 'Friday' }).click()
  await expect(page.locator('h2').filter({ hasText: 'Friday' })).toBeVisible()

  // Click Shuri agent button
  await page.locator('p.text-xs.font-semibold').filter({ hasText: 'Shuri' }).click()
  await expect(page.locator('h2').filter({ hasText: 'Shuri' })).toBeVisible()
})

test('empty chat shows placeholder message', async () => {
  await expect(page.getByText('Selecione um agente e envie sua mensagem')).toBeVisible()
})

test('input textarea is visible with correct placeholder', async () => {
  const textarea = page.locator('textarea').first()
  await expect(textarea).toBeVisible()
  await expect(textarea).toHaveAttribute('placeholder', /Mensagem para @jarvis/i)
})

test('send button is disabled when input is empty', async () => {
  const sendBtn = page.getByTitle('Enviar (Enter)')
  await expect(sendBtn).toBeDisabled()
})

test('send button becomes enabled when input has text', async () => {
  const sendBtn = page.getByTitle('Enviar (Enter)')
  await expect(sendBtn).toBeDisabled()

  await page.locator('textarea').first().fill('Olá Jarvis')
  await expect(sendBtn).toBeEnabled()
})

test('"Nova sessão" button is visible and resets chat', async () => {
  const btn = page.getByRole('button', { name: /Nova sessão/i })
  await expect(btn).toBeVisible()
  await expect(btn).toBeEnabled()

  await btn.click()
  // After new session, chat area shows the empty-state message
  await expect(page.getByText('Selecione um agente e envie sua mensagem')).toBeVisible()
})

test('execution toggle shows VPS and Local buttons', async () => {
  await expect(page.getByRole('button', { name: 'VPS' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Local' })).toBeVisible()
})

test('switching to Local mode shows folder path input', async () => {
  await page.getByRole('button', { name: 'Local' }).click()
  await expect(page.getByPlaceholder(/Pasta local/i)).toBeVisible()
})

test('"Contexto do Projeto" toggle reveals project context textarea', async () => {
  // Textarea is not rendered before the panel is opened
  await expect(page.getByPlaceholder(/Cole aqui o README/i)).not.toBeVisible()

  // Open the collapsible
  await page.getByText('Contexto do Projeto').click()
  await expect(page.getByPlaceholder(/Cole aqui o README/i)).toBeVisible()
})

test('project context indicator appears when text is entered', async () => {
  await page.getByText('Contexto do Projeto').click()
  await page.getByPlaceholder(/Cole aqui o README/i).fill('stack: React + Node')
  await expect(page.getByText(/Contexto ativo/i)).toBeVisible()
})

test('history panel shows empty state on fresh database', async () => {
  await expect(page.getByText('Nenhuma sessão ainda.')).toBeVisible()
})

test('back button navigates away from Squad fullscreen page', async () => {
  await page.getByTitle('Voltar').click()
  // Dashboard uses the Layout wrapper which has a <main> element;
  // the Squad fullscreen div does not, so its presence confirms we left Squad
  await expect(page.locator('main')).toBeVisible()
})
