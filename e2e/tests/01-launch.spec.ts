import { test, expect, ElectronApplication } from '@playwright/test'
import { launchApp, closeApp } from '../helpers/app'

let app: ElectronApplication

test.beforeEach(async () => {
  const launched = await launchApp()
  app = launched.app
})

test.afterEach(async () => {
  await closeApp(app)
})

test('app opens with correct window title', async () => {
  const title = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.getTitle()
  )
  expect(title).toContain('HEXAGON IDE')
})

test('main window is visible and not minimized', async () => {
  const isVisible = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    return win ? !win.isMinimized() && win.isVisible() : false
  })
  expect(isVisible).toBe(true)
})

test('renders sidebar brand name', async () => {
  const page = await app.firstWindow()
  await expect(page.getByText('HEXAGON IDE').first()).toBeVisible()
})

test('renders all primary navigation items', async () => {
  const page = await app.firstWindow()
  const labels = ['Dashboard', 'VPS', 'Projetos', 'Lançador', 'Monitor', 'Configurações', 'Manual']
  for (const label of labels) {
    await expect(page.getByRole('link', { name: label })).toBeVisible()
  }
})

test('AI HUB button is visible in sidebar', async () => {
  const page = await app.firstWindow()
  await expect(page.getByRole('button', { name: /AI HUB/i })).toBeVisible()
})
