const prettier = require('prettier')
const path = require('path')
const fs = require('fs')
const { exec } = require('child_process')
const { t, yes, no, format } = require('./utils')
const { promisify } = require('util')
const execAsync = promisify(exec)

async function formatFixture(name, extension) {
  let binPath = path.resolve(__dirname, '../node_modules/.bin/prettier')
  let filePath = path.resolve(__dirname, `fixtures/${name}/index.${extension}`)
  let pluginPath = path.resolve(__dirname, '../dist/index.js')

  let cmd

  if (prettier.version.startsWith('2.')) {
    cmd = `${binPath} ${filePath} --plugin-search-dir ${__dirname} --plugin ${pluginPath}`
  } else {
    cmd = `${binPath} ${filePath} --plugin ${pluginPath}`
  }

  return execAsync(cmd).then(({ stdout }) => stdout.trim())
}

let html = [
  t`<div class="${yes}"></div>`,
  t`<!-- <div class="${no}"></div> -->`,
  t`<div class="${no} {{ 'p-0 sm:p-0 m-0' }}"></div>`,
  t`<div not-class="${no}"></div>`,
  ['<div class="  sm:p-0   p-0 "></div>', '<div class="p-0 sm:p-0"></div>'],
  t`<div class></div>`,
  t`<div class=""></div>`,
  [
    '<div class="sm:flex-col sm:text-red-500 ${condition?\'sm:flex\':\'\'} block"></div>',
    '<div class="block ${condition?\'sm:flex\':\'\'} sm:flex-col sm:text-red-500"></div>'
  ],
  [
    '<div class="sm:flex-col sm:text-red-500 ${condition?\'\':\'sm:flex\'} block"></div>',
    '<div class="block ${condition?\'\':\'sm:flex\'} sm:flex-col sm:text-red-500"></div>'
  ],
  [
    '<div class="sm:flex-col sm:text-red-500 ${ condition ? \'sm:flex\' : \'\' } block"></div>',
    '<div class="block ${ condition ? \'sm:flex\' : \'\' } sm:flex-col sm:text-red-500"></div>'
  ],
  [
    '<div class="sm:flex-col sm:text-red-500 ${ condition ? \'\' : \'sm:flex\' } block"></div>',
    '<div class="block ${ condition ? \'\' : \'sm:flex\' } sm:flex-col sm:text-red-500"></div>'
  ],
  [
    '<div class="sm:flex-col sm:text-red-500 ${\'sm:flex\'|valueConverter:condition} block"></div>',
    '<div class="block ${\'sm:flex\'|valueConverter:condition} sm:flex-col sm:text-red-500"></div>'
  ],
  [
    '<div class="sm:flex-col sm:text-red-500 ${ \'sm:flex\' | valueConverter:condition } block"></div>',
    '<div class="block ${ \'sm:flex\' | valueConverter:condition } sm:flex-col sm:text-red-500"></div>'
  ],
]

let css = [
  t`@apply ${yes};`,
  t`/* @apply ${no}; */`,
  t`@not-apply ${no};`,
  ['@apply sm:p-0\n   p-0;', '@apply p-0\n   sm:p-0;'],
]

let tests = {
  html,
  css: [...css, t`@apply ${yes} !important;`],
  scss: [...css, t`@apply ${yes} #{!important};`],
  less: [...css, t`@apply ${yes} !important;`],
}

describe('parsers', () => {
  for (let parser in tests) {
    test(parser, async () => {
      for (let [input, expected] of tests[parser]) {
        expect(await format(input, { parser })).toEqual(expected)
      }
    })
  }
})

describe('other', () => {
  test('non-tailwind classes', async () => {
    expect(
      await format('<div class="sm:lowercase uppercase potato text-sm"></div>'),
    ).toEqual('<div class="potato text-sm uppercase sm:lowercase"></div>')
  })

  test('parasite utilities', async () => {
    expect(
      await format('<div class="group peer unknown-class p-0 container"></div>'),
    ).toEqual('<div class="unknown-class group peer container p-0"></div>')
  })

  test('explicit config path', async () => {
    expect(
      await format('<div class="sm:bg-tomato bg-red-500"></div>', {
        tailwindConfig: path.resolve(
          __dirname,
          'fixtures/basic/tailwind.config.js',
        ),
      }),
    ).toEqual('<div class="bg-red-500 sm:bg-tomato"></div>')
  })
})
