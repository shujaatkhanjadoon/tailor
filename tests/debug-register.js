// Debug the register loader
const fs = require('fs')
const d = fs.readFileSync(__dirname + '/register-path-aliases.js', 'utf8')
// Extract the register call content
const start = d.indexOf('`data:text/javascript,${encodeURIComponent(`')
const end = d.indexOf('`)}`', start)
const inner = d.substring(start, end)
// Remove the prefix up to encodeURIComponent(
const codeStart = inner.indexOf('`')
const codeEnd = inner.lastIndexOf('`')
const rawCode = inner.substring(codeStart + 1, codeEnd)
console.log('Encoded source:')
console.log(rawCode)
console.log('---')
try {
  new Function(rawCode)
  console.log('Syntax OK')
} catch (e) {
  console.error('Syntax Error:', e.message)
}
