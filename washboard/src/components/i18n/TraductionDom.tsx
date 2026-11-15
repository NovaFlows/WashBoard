'use client'

import { useEffect } from 'react'
import type { Dictionnaire } from '@/lib/i18n/traduire'

// Filet de sécurité de la traduction : après l'affichage, tout texte qui est EXACTEMENT une phrase du dictionnaire
// (ou qui épouse une phrase à `{variables}`) est remplacé par sa traduction.
//
// Pourquoi : une grande partie du texte vient de `lib/` (libellés de statuts, guide d'aide, noms d'offres, relances,
// libellés de graphiques…) et traverse des dizaines d'écrans sans passer par `t()`. L'envelopper à chaque endroit où
// il s'affiche est la bonne méthode (et reste la règle pour tout nouveau texte : voir la mémoire du projet) ; ce
// filet évite en attendant qu'un libellé oublié reste en français dans une interface anglaise, espagnole ou allemande.
//
// Limites assumées : seules les phrases entières présentes dans le dictionnaire sont touchées (jamais une phrase
// recomposée mot à mot), les textes saisis par les laveurs ne sont traduits que s'ils sont identiques à une phrase
// du dictionnaire, et il y a un très bref instant en français avant le remplacement. Les robots reçoivent le
// français (voir `detecterLangue`), le référencement n'est donc pas touché.

const ATTRIBUTS = ['placeholder', 'title', 'aria-label', 'alt'] as const
const IGNORES = 'script, style, textarea, code, pre, [data-i18n-ignore], [contenteditable="true"]'

type Motif = { re: RegExp; cible: string; noms: string[] }

function compiler(dictionnaire: Dictionnaire): { exacts: Map<string, string>; motifs: Motif[] } {
  const exacts = new Map<string, string>()
  const motifs: Motif[] = []
  for (const [fr, cible] of Object.entries(dictionnaire)) {
    if (!cible || cible === fr) continue
    if (!/\{\w+\}/.test(fr)) { exacts.set(fr.trim(), cible); continue }
    // Phrase à variables : `{n}` capte n'importe quel texte court.
    const noms: string[] = []
    const source = fr.trim().split(/(\{\w+\})/).map(morceau => {
      const m = /^\{(\w+)\}$/.exec(morceau)
      if (m) { noms.push(m[1]); return '(.{1,80}?)' }
      return morceau.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }).join('')
    // Au moins quelques lettres fixes : sinon le motif attraperait n'importe quoi.
    if (source.replace(/\(\.\{1,80\}\?\)/g, '').replace(/\\./g, '').replace(/\s/g, '').length < 4) continue
    try { motifs.push({ re: new RegExp(`^${source}$`, 's'), cible, noms }) } catch { /* motif invalide : ignoré */ }
  }
  return { exacts, motifs }
}

export default function TraductionDom({ dictionnaire }: { dictionnaire: Dictionnaire }) {
  useEffect(() => {
    const { exacts, motifs } = compiler(dictionnaire)

    const traduireTexte = (brut: string): string | null => {
      const t = brut.trim()
      if (t.length < 3 || t.length > 400) return null
      const direct = exacts.get(t)
      if (direct) return brut.replace(t, direct)
      if (!motifs.length || !/[A-Za-zÀ-ÿ]{3}/.test(t)) return null
      for (const m of motifs) {
        const r = m.re.exec(t)
        if (!r) continue
        let sortie = m.cible
        m.noms.forEach((nom, i) => { sortie = sortie.split(`{${nom}}`).join(r[i + 1] ?? '') })
        return brut.replace(t, sortie)
      }
      return null
    }

    // Ce que le filet a lui-même écrit : le retraiter ferait grossir le texte à chaque passage (« cliente » qui
    // épouse à nouveau « {n} client{s} » → « clienteeee… »). Une valeur écrite par nous n'est jamais retraduite.
    const ecrit = new WeakMap<Node, string>()
    const ecritAttr = new WeakMap<Element, Map<string, string>>()
    const traiterNoeudTexte = (n: Text) => {
      const brut = n.nodeValue
      if (!brut) return
      if (ecrit.get(n) === brut) return
      const parent = n.parentElement
      if (!parent || parent.closest(IGNORES)) return
      // Une phrase coupée par un élément en ligne (« lien de <b>réservation</b> ») : traduire un seul morceau
      // donnerait un mélange de langues, pire que le français entier. Seul un texte qui occupe TOUT son parent
      // (ou son parent et rien d'autre de lisible) est remplacé.
      const voisins = Array.from(parent.childNodes).filter(x => x !== n && (x.nodeType === Node.ELEMENT_NODE ? /\S/.test(x.textContent ?? '') : /\S/.test(x.nodeValue ?? '')))
      if (voisins.length > 0) return
      const nouveau = traduireTexte(brut)
      if (nouveau !== null && nouveau !== brut) { ecrit.set(n, nouveau); n.nodeValue = nouveau }
    }
    const traiterAttributs = (el: Element) => {
      if (el.closest(IGNORES)) return
      for (const a of ATTRIBUTS) {
        const v = el.getAttribute(a)
        if (!v) continue
        if (ecritAttr.get(el)?.get(a) === v) continue
        const nouveau = traduireTexte(v)
        if (nouveau !== null && nouveau !== v) {
          const m = ecritAttr.get(el) ?? new Map<string, string>()
          m.set(a, nouveau); ecritAttr.set(el, m)
          el.setAttribute(a, nouveau)
        }
      }
    }
    const parcourir = (racine: Node) => {
      if (racine.nodeType === Node.TEXT_NODE) { traiterNoeudTexte(racine as Text); return }
      if (racine.nodeType !== Node.ELEMENT_NODE) return
      const el = racine as Element
      traiterAttributs(el)
      const marcheur = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
      for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
        if (n.nodeType === Node.TEXT_NODE) traiterNoeudTexte(n as Text)
        else traiterAttributs(n as Element)
      }
    }

    // Plusieurs rafales de changements d'un coup (animations, listes) : un seul passage par image.
    const file = new Set<Node>()
    let planifie = 0
    const vider = () => {
      planifie = 0
      const lot = [...file]
      file.clear()
      for (const n of lot) if (n.isConnected) parcourir(n)
    }
    const planifier = (n: Node) => {
      file.add(n)
      if (!planifie) planifie = requestAnimationFrame(vider)
    }

    parcourir(document.body)
    const obs = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'childList') m.addedNodes.forEach(planifier)
        else if (m.type === 'characterData') planifier(m.target)
        else if (m.type === 'attributes') planifier(m.target)
      }
    })
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRIBUTS] })
    return () => { obs.disconnect(); if (planifie) cancelAnimationFrame(planifie) }
  }, [dictionnaire])

  return null
}
