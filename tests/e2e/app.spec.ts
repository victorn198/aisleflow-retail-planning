import { expect, test } from '@playwright/test'

test('renders, recalculates period, switches language, and fits mobile', async ({ page }) => {
  test.setTimeout(120000)
  await page.setViewportSize({width:390,height:844})
  await page.goto('/')
  await expect(page.locator('.brand')).toContainText('AisleFlow')
  await page.locator('.decision-strip:not(.is-loading)').waitFor({timeout:90000})
  const before=await page.locator('.metric-card strong').first().innerText()
  await page.locator('select').first().selectOption('7')
  await page.locator('.decision-strip:not(.is-loading)').waitFor({timeout:90000})
  await expect.poll(()=>page.locator('.metric-card strong').first().innerText()).not.toBe(before)
  await page.getByRole('button',{name:'PT'}).click()
  await expect(page.getByText('Escopo de planejamento')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
})

test('shows full history and snapshot metrics honestly',async({page})=>{
  test.setTimeout(120000);await page.goto('/');await page.locator('.decision-strip:not(.is-loading)').waitFor({timeout:90000});await page.locator('select').first().selectOption('all');await page.locator('.decision-strip:not(.is-loading)').waitFor({timeout:90000});await expect(page.locator('.metric-card .delta.neutral').first()).toContainText('no prior window');await expect(page.locator('.metric-card').last()).toContainText('current snapshot')
})

test('operations lab exposes five distinct inventory lenses',async({page})=>{
  test.setTimeout(120000);await page.goto('/');await expect(page.getByText('What needs an owner today')).toBeVisible({timeout:90000});await page.getByRole('tab',{name:'Coverage'}).click();await expect(page.getByText('Does current stock cover target?')).toBeVisible();await page.getByRole('tab',{name:'Drivers'}).click();await expect(page.getByText('Which divisions moved sales?')).toBeVisible();await page.getByRole('tab',{name:'Variability'}).click();await expect(page.getByText('Stable or irregular sales?')).toBeVisible();await page.getByRole('tab',{name:'Scenario'}).click();await expect(page.getByText('Linear 12-day sensitivity; not a purchase order.')).toBeVisible()
})

test('every secondary page exposes five page-specific and distinct lenses',async({page})=>{
  test.setTimeout(180000);await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('.decision-strip:not(.is-loading)').waitFor({timeout:90000});const pages=page.locator('header nav button');for(let i=1;i<await pages.count();i+=1){await pages.nth(i).click();await page.locator('.decision-strip:not(.is-loading)').waitFor({timeout:90000});await expect(page.locator('.query-error')).toHaveCount(0);const lab=page.locator('.ops-lab'),tabs=lab.getByRole('tab');await expect(tabs).toHaveCount(5);const states=new Set<string>();for(let j=0;j<5;j+=1){await tabs.nth(j).click();states.add(await lab.locator('.ops-lab-body').innerText())}expect(states.size).toBe(5);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)}
})
