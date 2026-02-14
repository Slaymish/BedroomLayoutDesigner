import fs from 'node:fs/promises'
import path from 'node:path'

const VALID_STATUSES = new Set(['backlog', 'ready', 'in_progress', 'done', 'icebox'])

const parseArgs = (argv) => {
  const args = {
    all: false,
    limit: 10,
    statuses: ['ready', 'backlog'],
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]

    if (token === '--all') {
      args.all = true
      continue
    }

    if (token === '--limit') {
      const next = argv[i + 1]
      if (!next) {
        throw new Error('Missing value for --limit')
      }
      const parsed = Number.parseInt(next, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --limit value: ${next}`)
      }
      args.limit = parsed
      i += 1
      continue
    }

    if (token === '--status') {
      const next = argv[i + 1]
      if (!next) {
        throw new Error('Missing value for --status')
      }
      const parsedStatuses = next
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)

      if (parsedStatuses.length === 0) {
        throw new Error('Provide at least one status for --status')
      }

      for (const status of parsedStatuses) {
        if (!VALID_STATUSES.has(status)) {
          throw new Error(`Invalid status: ${status}`)
        }
      }

      args.statuses = parsedStatuses
      i += 1
      continue
    }

    throw new Error(`Unknown argument: ${token}`)
  }

  return args
}

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

const toPriorityScore = (scores) => {
  const impact = Number(scores?.impact ?? 0)
  const urgency = Number(scores?.urgency ?? 0)
  const riskReduction = Number(scores?.riskReduction ?? 0)
  const confidence = Number(scores?.confidence ?? 0)
  const effort = Number(scores?.effort ?? 0)

  if (effort <= 0) {
    return 0
  }

  return ((impact * 2) + urgency + riskReduction + confidence) / effort
}

const renderStory = (story, index, personaNamesById) => {
  const score = toPriorityScore(story.scores)
  const personaNames = (story.personaIds ?? []).map((id) => personaNamesById.get(id) ?? `${id} (missing persona)`).join(', ')
  const dependencies = story.dependencies?.length ? story.dependencies.join(', ') : 'none'
  const acceptance = story.acceptanceCriteria?.length ? story.acceptanceCriteria.join(' | ') : 'none listed'

  return [
    `${index + 1}. ${story.id} [${story.status}] score=${score.toFixed(2)} :: ${story.title}`,
    `   Personas: ${personaNames || 'none linked'}`,
    `   Story: ${story.story}`,
    `   Acceptance: ${acceptance}`,
    `   Dependencies: ${dependencies}`,
  ].join('\n')
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  const repoRoot = process.cwd()
  const personasPath = path.join(repoRoot, 'docs', 'user-story-workflow', 'personas.json')
  const backlogPath = path.join(repoRoot, 'docs', 'user-story-workflow', 'backlog.json')

  const [personasDoc, backlogDoc] = await Promise.all([readJson(personasPath), readJson(backlogPath)])

  const personaNamesById = new Map((personasDoc.personas ?? []).map((persona) => [persona.id, persona.name]))

  const selected = (backlogDoc.stories ?? [])
    .filter((story) => args.all || args.statuses.includes(story.status))
    .map((story) => ({
      ...story,
      computedScore: toPriorityScore(story.scores),
    }))
    .sort((a, b) => b.computedScore - a.computedScore || a.id.localeCompare(b.id))
    .slice(0, args.limit)

  const statusLabel = args.all ? 'all' : args.statuses.join(',')
  const lines = [
    'User Story Prioritization',
    `Formula: ((impact * 2) + urgency + riskReduction + confidence) / effort`,
    `Statuses: ${statusLabel}`,
    `Limit: ${args.limit}`,
    '',
  ]

  if (selected.length === 0) {
    lines.push('No stories matched the selected filters.')
    console.log(lines.join('\n'))
    return
  }

  selected.forEach((story, index) => {
    lines.push(renderStory(story, index, personaNamesById))
    lines.push('')
  })

  console.log(lines.join('\n').trim())
}

main().catch((error) => {
  console.error(`Story prioritization failed: ${error.message}`)
  process.exitCode = 1
})
