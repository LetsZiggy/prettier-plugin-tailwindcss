export function bigSign(bigIntValue) {
  return (bigIntValue > 0n) - (bigIntValue < 0n)
}

function prefixCandidate(context, selector) {
  let prefix = context.tailwindConfig.prefix
  return typeof prefix === 'function' ? prefix(selector) : prefix + selector
}

// Polyfill for older Tailwind CSS versions
function getClassOrderPolyfill(classes, { env }) {
  // A list of utilities that are used by certain Tailwind CSS utilities but
  // that don't exist on their own. This will result in them "not existing" and
  // sorting could be weird since you still require them in order to make the
  // host utitlies work properly. (Thanks Biology)
  let parasiteUtilities = new Set([
    prefixCandidate(env.context, 'group'),
    prefixCandidate(env.context, 'peer'),
  ])

  let classNamesWithOrder = []

  for (let className of classes) {
    let order =
      env
        .generateRules(new Set([className]), env.context)
        .sort(([a], [z]) => bigSign(z - a))[0]?.[0] ?? null

    if (order === null && parasiteUtilities.has(className)) {
      // This will make sure that it is at the very beginning of the
      // `components` layer which technically means 'before any
      // components'.
      order = env.context.layerOrder.components
    }

    classNamesWithOrder.push([className, order])
  }

  return classNamesWithOrder
}

// Naive aurelia.js templating support
function getClassNameFromStringExpression (classes) {
  return classes
    .map((curr) => {
      if (!curr.startsWith("${")) {
        return curr
      }

      curr = curr.replaceAll(/ +/g, " ")
      let reducedClasses = undefined

      // if using value converter (eg: "${ 'className' | valueConverter:param1 }")
      if (/(?<!\|)\|(?!\|)/.test(curr)) {
        reducedClasses = curr
          .split("|")[0]
          .split(/["'`]/)[1]
      }
      // if using ternary (eg: "${ condition ? 'className1' : 'className2' }")
      else if (/(?<!\?)\?(?!\?)/.test(curr) && /(?<=["'` ]):(?=["'` ])/.test(curr)) {
        reducedClasses = curr
          .split(/(?<!\?)\?(?!\?)/)[1]
          .split(/["'`]/)
          .reduce((acc, value, index) => {
            if (index === 1 || index === 3) {
              acc.push(value)
            }

            return acc
          }, [])
          .find((innercurr) => /^[\w-:&/'`\[\]\(\)\.]+$/.test(innercurr))
      }
      else {
        return curr
      }

      return (
        (reducedClasses === undefined || reducedClasses.length === 0)
          ? curr
          : [ curr, reducedClasses ]
      )
    })
}

// Naive aurelia.js templating support
function concatStringExpressionClassNames (classes, whitespace) {
  let { stringExpressionClasses, stringExpressionWhitespace } = classes
    .reduce((acc, curr, index) => {
      if (acc.ternary) {
        const last = acc.stringExpressionClasses.length - 1
        acc.stringExpressionWhitespace.push(index - 1)
        acc.stringExpressionClasses[last] = `${ acc.stringExpressionClasses[last] }${ whitespace[index - 1] }${ curr }`

        if (curr === "}") {
          acc.ternary = false
        }
      }
      else {
        acc.stringExpressionClasses.push(curr)

        if (curr === "${") {
          acc.ternary = true
        }
      }

      return acc
    }, { ternary: false, stringExpressionClasses: [], stringExpressionWhitespace: [] })

  const reducedClasses = getClassNameFromStringExpression(stringExpressionClasses)

  stringExpressionClasses = reducedClasses
    .map((curr) => {
      if (typeof curr === "string") {
        return curr
      }

      return curr[1]
    })

  stringExpressionWhitespace = whitespace
    .filter((curr, index) => !stringExpressionWhitespace.includes(index))

  return ({ stringExpressionClasses, stringExpressionWhitespace, reducedClasses })
}

// Naive aurelia.js templating support
function remapStringExpressionClassNames (classes, reducedClasses) {
  reducedClasses
    .filter((curr) => Array.isArray(curr))
    .forEach(([ original, reduced ]) => {
      const index = classes
        .findIndex((innercurr) => innercurr === reduced)

      classes[index] = original
    })

  return classes
}

export function sortClasses(
  classStr,
  { env, ignoreFirst = false, ignoreLast = false },
) {
  if (typeof classStr !== 'string' || classStr === '') {
    return classStr
  }

  // Ignore class attributes containing `{{`, to match Prettier behaviour:
  // https://github.com/prettier/prettier/blob/main/src/language-html/embed.js#L83-L88
  if (classStr.includes('{{')) {
    return classStr
  }

  let result = ''
  let parts = classStr.split(/([\t\r\f\n ]+)/)
  let classes = parts.filter((_, i) => i % 2 === 0)
  let whitespace = parts.filter((_, i) => i % 2 !== 0)

  if (classes[classes.length - 1] === '') {
    classes.pop()
  }

  let prefix = ''
  if (ignoreFirst) {
    prefix = `${classes.shift() ?? ''}${whitespace.shift() ?? ''}`
  }

  let suffix = ''
  if (ignoreLast) {
    suffix = `${whitespace.pop() ?? ''}${classes.pop() ?? ''}`
  }

  // Naive aurelia.js templating support
  const ternary = concatStringExpressionClassNames(classes, whitespace)
  classes = ternary.stringExpressionClasses
  whitespace = ternary.stringExpressionWhitespace

  classes = sortClassList(classes, { env })

  // Naive aurelia.js templating support
  classes = remapStringExpressionClassNames(classes, ternary.reducedClasses)

  for (let i = 0; i < classes.length; i++) {
    result += `${classes[i]}${whitespace[i] ?? ''}`
  }

  return prefix + result + suffix
}

export function sortClassList(classList, { env }) {
  let classNamesWithOrder = env.context.getClassOrder
    ? env.context.getClassOrder(classList)
    : getClassOrderPolyfill(classList, { env })

  return classNamesWithOrder
    .sort(([, a], [, z]) => {
      if (a === z) return 0
      // if (a === null) return options.unknownClassPosition === 'start' ? -1 : 1
      // if (z === null) return options.unknownClassPosition === 'start' ? 1 : -1
      if (a === null) return -1
      if (z === null) return 1
      return bigSign(a - z)
    })
    .map(([className]) => className)
}
