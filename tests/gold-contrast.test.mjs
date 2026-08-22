import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const css = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

function luminance(hex) {
  const [r, g, b] = hex
    .replace('#', '')
    .match(/.{2}/g)
    .map((pair) => {
      const channel = parseInt(pair, 16) / 255
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

test('Frizi Client gold buttons use dark foreground with AA contrast', () => {
  assert.match(css, /--frizi-gold:\s*var\(--client-accent\);/)
  assert.match(css, /--frizi-on-gold:\s*#17130c;/)
  assert.match(css, /\.clientApp \.friziGoldButton\s*{[\s\S]*color:\s*var\(--frizi-on-gold\)\s*!important;/)
  assert.ok(contrast('#17130c', '#c89b22') >= 4.5)
})

test('Frizi Client notification enable buttons use canonical gold button class', () => {
  const notificationCardButton =
    /<button className="friziGoldButton[^"]*"[\s\S]*?Enable notifications[\s\S]*?<\/button>/.test(app)
  const settingsButton =
    /<button[\s\S]*?className="friziGoldButton[^"]*"[\s\S]*?Enable push notifications[\s\S]*?<\/button>/.test(app)

  assert.equal(notificationCardButton, true)
  assert.equal(settingsButton, true)
  assert.doesNotMatch(app, /Enable push notifications[\s\S]{0,220}text-white/)
})
