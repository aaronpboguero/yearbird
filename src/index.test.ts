import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('index.html fallback content', () => {
  const indexHtml = readFileSync(resolve(__dirname, '../index.html'), 'utf-8')

  test('hides fallback content by default to prevent flash', () => {
    // Regression test: fallback content was flashing for ~200ms before React mounted
    // Fix: hide with CSS by default, show via noscript for non-JS users
    expect(indexHtml).toContain('[data-fallback] { display: none; }')
  })

  test('shows fallback for non-JS users via noscript', () => {
    // Non-JS users (and some crawlers) should still see the fallback content
    expect(indexHtml).toContain('<noscript><style>[data-fallback] { display: block; }</style></noscript>')
  })

  test('fallback div has data-fallback attribute', () => {
    expect(indexHtml).toContain('data-fallback')
  })
})
