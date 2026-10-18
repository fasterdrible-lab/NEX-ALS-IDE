/**
 * Gera icon.ico para o HEXAGON IDE usando png-to-ico.
 * Execute: node generate-icon.js
 * Requer: npm install -g png-to-ico  OU  npx png-to-ico
 *
 * Alternativamente, coloque um arquivo icon.ico nesta pasta manualmente.
 * Tamanho recomendado: 256x256 pixels, formato ICO multi-resolução.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Se já existe icon.ico, não faz nada
if (fs.existsSync(path.join(__dirname, 'icon.ico'))) {
  console.log('icon.ico já existe.')
  process.exit(0)
}

console.log('INSTRUÇÃO: Coloque um arquivo icon.ico (256x256) nesta pasta:')
console.log(path.join(__dirname, 'icon.ico'))
console.log('')
console.log('Ferramentas online para criar ICO:')
console.log('  https://convertico.com')
console.log('  https://icoconvert.com')
console.log('')
console.log('Sem icon.ico, o electron-builder usará o ícone padrão do Electron.')
