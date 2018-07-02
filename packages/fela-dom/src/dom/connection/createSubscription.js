/* @flow */
/* eslint-disable consistent-return */
import objectEach from 'fast-loops/lib/objectEach'
import {
  RULE_TYPE,
  KEYFRAME_TYPE,
  FONT_TYPE,
  STATIC_TYPE,
  CLEAR_TYPE,
  getRuleScore,
  generateCSSRule,
} from 'fela-utils'

import getNodeFromCache from './getNodeFromCache'
import generateRule from './generateRule'

import renderToSheetList from '../../server/renderToSheetList'

import type { DOMRenderer } from '../../../../../flowtypes/DOMRenderer'

const changeHandlers = {
  [RULE_TYPE]: (node, { selector, declaration, support, pseudo }, renderer) => {
    const cssRule = generateRule(selector, declaration, support)

    // only use insertRule in production as browser devtools might have
    // weird behavior if used together with insertRule at runtime
    if (renderer.devMode) {
      // TODO: refactor this super hacky devMode version of sorted output
      const sheetList = renderToSheetList(renderer)

      const media = node.getAttribute('media') || undefined
      const support = node.getAttribute('data-fela-support') || undefined

      const sheet = sheetList.find(
        sheet =>
          sheet.type === RULE_TYPE &&
          sheet.media === media &&
          sheet.support === support
      )

      node.textContent = sheet ? sheet.css : ''
      return
    }

    try {
      const score = getRuleScore(renderer.ruleOrder, pseudo)
      const cssRules = node.sheet.cssRules

      let index = cssRules.length

      // TODO: (PERF) instead of checking the score every time
      // we could save the latest score=0 index to quickly inject
      // basic styles and only check for score!=0 (e.g. pseudo classes)
      for (let i = 0, len = cssRules.length; i < len; ++i) {
        if (cssRules[i].score > score) {
          index = i
          break
        }
      }

      node.sheet.insertRule(cssRule, index)
      cssRules[index].score = score
    } catch (e) {
      // TODO: warning?
    }
  },
  [KEYFRAME_TYPE]: (node, { keyframe }) => {
    node.textContent += keyframe
  },
  [FONT_TYPE]: (node, { fontFace }) => {
    node.textContent += fontFace
  },
  [STATIC_TYPE]: (node, { selector, css }) => {
    if (selector) {
      node.textContent += generateCSSRule(selector, css)
    } else {
      node.textContent += css
    }
  },
}

export default function createSubscription(renderer: DOMRenderer): Function {
  return change => {
    if (change.type === CLEAR_TYPE) {
      return objectEach(renderer.nodes, ({ node }) =>
        node.parentNode.removeChild(node)
      )
    }

    const handleChange = changeHandlers[change.type]

    if (handleChange) {
      handleChange(getNodeFromCache(change, renderer), change, renderer)
    }
  }
}
