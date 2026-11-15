// Enveloppe les textes français d'un composant React dans t('…') (analyse syntaxique TypeScript).
// Usage, depuis washboard/ : node scripts/i18n/envelopper.cjs src/components/dashboard/X.tsx [--dry]
// Écrit les phrases trouvées dans $I18N_PHRASES_DIR (défaut : tmp/wb-phrases) pour écrire les dictionnaires.
// Ne touche QUE le JSX (texte + attributs placeholder/title/aria-label/label/…) : les textes écrits dans des
// tableaux, des messages d'erreur ou des gabarits restent à envelopper à la main.
//  - phrases écrites dans scratchpad/phrases/<nom>.json
const ts = require(process.cwd() + '/node_modules/typescript')
const fs = require('fs')
const path = require('path')

// Nom de la fonction de traduction : `t` par défaut, `I18N_FN=tr` quand `t` est déjà pris (fichier de démonstration).
const FN = process.env.I18N_FN || 't'
const SC = process.env.I18N_PHRASES_DIR || require('os').tmpdir() + '/wb-phrases'
fs.mkdirSync(SC, { recursive: true })
const ATTRS = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label', 'titre', 'sousTitre', 'texte', 'libelle', 'aide', 'description', 'surTitre', 'etiquette', 'sousLabel', 'valeur', 'message', 'aucunLabel', 'vide'])

const LETTRES = /[A-Za-zÀ-ÿ]{2}/
function aTraduire(s) {
  const t = s.trim()
  if (!LETTRES.test(t)) return false
  if (/^https?:\/\//.test(t) || /^[\w./-]+\.(png|webp|svg|jpg|css|js)$/.test(t)) return false
  if (/^[a-z0-9]+([-_][a-z0-9]+)+$/.test(t)) return false // identifiant technique
  if (/^[A-Z0-9_]+$/.test(t)) return false
  return true
}
const decode = s => s.replace(/&apos;/g, '’').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, '’').replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à').replace(/&rsquo;/g, '’').replace(/&hellip;/g, '…')
const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

function estComposant(n) {
  const nomMaj = x => x && /^[A-Z]/.test(x)
  if (ts.isFunctionDeclaration(n)) return nomMaj(n.name && n.name.text) || (n.modifiers && n.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword))
  if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
    let p = n.parent
    while (p && ts.isParenthesizedExpression(p)) p = p.parent
    if (p && ts.isCallExpression(p)) { // memo(() => …) / forwardRef
      const f = p.expression.getText()
      if (/^(React\.)?(memo|forwardRef)$/.test(f)) { p = p.parent }
    }
    if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return nomMaj(p.name.text)
    if (p && ts.isExportAssignment(p)) return true
  }
  return false
}

function traiter(fichier, dry) {
  const src = fs.readFileSync(fichier, 'utf8')
  const sf = ts.createSourceFile(fichier, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  // t déjà utilisé comme identifiant (variable, paramètre) ?
  let conflitT = false
  const edits = [] // {start,end,text}
  const phrases = []
  const composants = new Map() // noeud -> true
  const sansComposant = []

  const comp = n => {
    let p = n.parent
    while (p) {
      if ((ts.isFunctionDeclaration(p) || ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && estComposant(p)) return p
      p = p.parent
    }
    return null
  }

  function visit(n) {
    if (ts.isIdentifier(n) && n.text === FN) {
      const par = n.parent
      const estDecl = (ts.isVariableDeclaration(par) && par.name === n) || (ts.isParameter(par) && par.name === n) || (ts.isBindingElement(par) && par.name === n)
      if (estDecl) conflitT = true
    }
    if (ts.isJsxText(n)) {
      const brut = n.getText()
      if (aTraduire(brut) && !/^\s*$/.test(brut)) {
        const lead = brut.match(/^\s*/)[0], trail = brut.match(/\s*$/)[0]
        const coeur = brut.slice(lead.length, brut.length - trail.length)
        const cle = decode(coeur.replace(/\s+/g, ' '))
        const c = comp(n)
        if (c) { composants.set(c, true); edits.push({ start: n.getStart() + lead.length, end: n.getEnd() - trail.length, text: `{${FN}('${esc(cle)}')}` }); phrases.push(cle) } else sansComposant.push(cle)
      }
    } else if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer) && ATTRS.has(n.name.getText())) {
      const v = n.initializer.text
      if (aTraduire(v)) {
        const c = comp(n)
        if (c) { composants.set(c, true); edits.push({ start: n.initializer.getStart(), end: n.initializer.getEnd(), text: `{${FN}('${esc(decode(v))}')}` }); phrases.push(decode(v)) } else sansComposant.push(v)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (conflitT) return { fichier, ignore: 'identifiant « t » déjà utilisé' }
  if (!edits.length) return { fichier, n: 0 }

  // hook dans chaque composant
  for (const c of composants.keys()) {
    const corps = c.body
    if (ts.isBlock(corps)) {
      const dejaT = corps.statements.some(s => ts.isVariableStatement(s) && s.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === FN))
      if (!dejaT) edits.push({ start: corps.getStart() + 1, end: corps.getStart() + 1, text: `\n  const ${FN} = useT()` })
    } else {
      edits.push({ start: corps.getStart(), end: corps.getEnd(), text: `{\n  const ${FN} = useT()\n  return ${corps.getText()}\n}` })
    }
  }
  // import
  if (!/useT\b/.test(src)) {
    const imports = sf.statements.filter(ts.isImportDeclaration)
    const pos = imports.length ? imports[imports.length - 1].getEnd() : 0
    edits.push({ start: pos, end: pos, text: "\nimport { useT } from '@/components/i18n/I18nProvider'" })
  }
  // 'use client' obligatoire (hook)
  const aClient = /^\s*(\/\/.*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(src)

  edits.sort((a, b) => b.start - a.start || b.end - a.end)
  let out = src
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  if (!dry) fs.writeFileSync(fichier, out)
  const nom = path.basename(fichier).replace(/\.[tj]sx?$/, '')
  fs.writeFileSync(path.join(SC, nom + '.json'), JSON.stringify([...new Set(phrases)], null, 0))
  return { fichier, n: new Set(phrases).size, serveur: !aClient, sansComposant: [...new Set(sansComposant)].length }
}

const args = process.argv.slice(2)
const dry = args.includes('--dry')
for (const f of args.filter(a => !a.startsWith('--'))) console.log(JSON.stringify(traiter(f, dry)))
