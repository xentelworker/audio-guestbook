import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline/promises'
import {
  stdin as input,
  stdout as output,
} from 'node:process'
import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// PROJECT / ENVIRONMENT FILES
// ============================================================

const PROJECT_DIR = process.cwd()

const ENV_PATH =
  path.join(PROJECT_DIR, '.env')

const ENV_LOCAL_PATH =
  path.join(PROJECT_DIR, '.env.local')

const ENV_REPAIR_PATH =
  path.join(PROJECT_DIR, '.env.repair')

// ============================================================
// READ ENVIRONMENT FILE
// ============================================================

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const values = {}

  const lines =
    fs.readFileSync(
      filePath,
      'utf8'
    ).split(/\r?\n/)

  for (const rawLine of lines) {
    const line =
      rawLine.trim()

    if (
      !line ||
      line.startsWith('#')
    ) {
      continue
    }

    const equalsIndex =
      line.indexOf('=')

    if (equalsIndex < 1) {
      continue
    }

    const key =
      line
        .slice(
          0,
          equalsIndex
        )
        .trim()

    let value =
      line
        .slice(
          equalsIndex + 1
        )
        .trim()

    if (
      (
        value.startsWith('"') &&
        value.endsWith('"')
      ) ||
      (
        value.startsWith("'") &&
        value.endsWith("'")
      )
    ) {
      value =
        value.slice(1, -1)
    }

    values[key] = value
  }

  return values
}

// ============================================================
// MERGE ENVIRONMENT
// ============================================================

const env = {
  ...readEnvFile(ENV_PATH),
  ...readEnvFile(ENV_LOCAL_PATH),
  ...readEnvFile(ENV_REPAIR_PATH),
  ...process.env,
}

// ============================================================
// CONFIGURATION
// ============================================================

const SUPABASE_URL =
  env.VITE_SUPABASE_URL ||
  env.SUPABASE_URL

const SUPABASE_ANON_KEY =
  env.VITE_SUPABASE_ANON_KEY ||
  env.SUPABASE_ANON_KEY

const API_URL =
  (
    env.VITE_AUDIO_API_URL ||
    env.AUDIO_API_URL ||
    'https://audio-guestbook-api.snapbooth.workers.dev'
  ).replace(/\/$/, '')

const REPAIR_EMAIL =
  env.REPAIR_EMAIL

const REPAIR_PASSWORD =
  env.REPAIR_PASSWORD

// ============================================================
// VALIDATE CONFIGURATION
// ============================================================

if (
  !SUPABASE_URL ||
  !SUPABASE_ANON_KEY
) {
  console.error(
    '\n============================================'
  )

  console.error(
    ' AUDIO GUESTBOOK REPAIR TOOL'
  )

  console.error(
    '============================================'
  )

  console.error(
    '\nMissing Supabase configuration.'
  )

  console.error(
    '\n.env.local must contain:'
  )

  console.error(
    'VITE_SUPABASE_URL=...'
  )

  console.error(
    'VITE_SUPABASE_ANON_KEY=...'
  )

  console.error(
    'VITE_AUDIO_API_URL=https://audio-guestbook-api.snapbooth.workers.dev'
  )

  console.error('')

  process.exit(1)
}

if (
  !REPAIR_EMAIL ||
  !REPAIR_PASSWORD
) {
  console.error(
    '\n============================================'
  )

  console.error(
    ' AUDIO GUESTBOOK REPAIR TOOL'
  )

  console.error(
    '============================================'
  )

  console.error(
    '\nMissing repair login credentials.'
  )

  console.error(
    '\n.env.repair must contain:'
  )

  console.error(
    'REPAIR_EMAIL=your-email@example.com'
  )

  console.error(
    'REPAIR_PASSWORD=your-password'
  )

  console.error('')

  process.exit(1)
}

if (!ffmpegPath) {
  console.error(
    '\nffmpeg-static could not find an FFmpeg binary.'
  )

  process.exit(1)
}

// ============================================================
// READLINE
// ============================================================

const rl =
  readline.createInterface({
    input,
    output,
  })

// ============================================================
// API FETCH
// ============================================================

async function apiFetch(
  token,
  route,
  options = {}
) {
  return fetch(
    `${API_URL}${route}`,
    {
      ...options,

      headers: {
        Authorization:
          `Bearer ${token}`,

        ...(options.headers || {}),
      },
    }
  )
}

// ============================================================
// API JSON
// ============================================================

async function apiJson(
  token,
  route,
  options = {}
) {
  const response =
    await apiFetch(
      token,
      route,
      options
    )

  const text =
    await response.text()

  let data = null

  if (text) {
    try {
      data =
        JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'object'
        ? (
            data?.message ||
            data?.error ||
            JSON.stringify(data)
          )
        : String(
            data ||
            response.statusText
          )

    throw new Error(
      `${response.status} ${message}`
    )
  }

  return data
}

// ============================================================
// RUN FFMPEG
// ============================================================

function runFfmpeg(args) {
  return new Promise(
    (resolve, reject) => {
      const child =
        spawn(
          ffmpegPath,
          args,
          {
            stdio: [
              'ignore',
              'pipe',
              'pipe',
            ],
          }
        )

      let stderr = ''

      child.stderr.on(
        'data',
        (chunk) => {
          stderr +=
            chunk.toString()
        }
      )

      child.on(
        'error',
        reject
      )

      child.on(
        'close',
        (code) => {
          if (code === 0) {
            resolve(stderr)

            return
          }

          reject(
            new Error(
              `FFmpeg exited with code ${code}\n${stderr.slice(
                -2500
              )}`
            )
          )
        }
      )
    }
  )
}

// ============================================================
// GET DURATION FROM FFMPEG OUTPUT
// ============================================================

function getDurationFromFfmpegOutput(
  stderr
) {
  const match =
    stderr.match(
      /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/
    )

  if (!match) {
    return 0
  }

  const hours =
    Number(match[1])

  const minutes =
    Number(match[2])

  const seconds =
    Number(match[3])

  return Math.max(
    0,
    Math.round(
      hours * 3600 +
      minutes * 60 +
      seconds
    )
  )
}

// ============================================================
// CONVERT AUDIO TO TRUE MP3
// ============================================================

async function convertToMp3(
  inputPath,
  outputPath
) {
  const stderr =
    await runFfmpeg([
      '-hide_banner',
      '-y',

      '-i',
      inputPath,

      '-vn',

      '-codec:a',
      'libmp3lame',

      '-b:a',
      '128k',

      '-ar',
      '44100',

      '-ac',
      '1',

      outputPath,
    ])

  return (
    getDurationFromFfmpegOutput(
      stderr
    )
  )
}

// ============================================================
// SAFE FILE NAME
// ============================================================

function safeFileName(
  name,
  fallback
) {
  return String(
    name ||
    fallback ||
    'recording.mp3'
  )
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      '_'
    )
    .slice(
      0,
      180
    )
}

// ============================================================
// DOWNLOAD ORIGINAL MESSAGE
// ============================================================

async function downloadMessage(
  token,
  message,
  tempDir
) {
  const response =
    await apiFetch(
      token,
      `/audio/${encodeURIComponent(
        message.id
      )}?download=1`
    )

  if (!response.ok) {
    throw new Error(
      `Download failed (${response.status})`
    )
  }

  const bytes =
    Buffer.from(
      await response.arrayBuffer()
    )

  if (!bytes.length) {
    throw new Error(
      'Downloaded audio file is empty.'
    )
  }

  const fileName =
    safeFileName(
      message.file_name,
      `message-${message.message_number}.mp3`
    )

  const inputPath =
    path.join(
      tempDir,
      `input-${message.id}-${fileName}`
    )

  fs.writeFileSync(
    inputPath,
    bytes
  )

  return {
    inputPath,
    originalSize:
      bytes.length,
  }
}

// ============================================================
// REPAIR ONE MESSAGE
// ============================================================

async function repairMessage(
  token,
  message,
  tempDir
) {
  const {
    inputPath,
    originalSize,
  } =
    await downloadMessage(
      token,
      message,
      tempDir
    )

  const outputPath =
    path.join(
      tempDir,
      `repaired-${message.id}.mp3`
    )

  const duration =
    await convertToMp3(
      inputPath,
      outputPath
    )

  const repaired =
    fs.readFileSync(
      outputPath
    )

  if (!repaired.length) {
    throw new Error(
      'FFmpeg produced an empty repaired file.'
    )
  }

  const response =
    await apiFetch(
      token,
      `/repair/message/${encodeURIComponent(
        message.id
      )}`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'audio/mpeg',

          'X-File-Size':
            String(
              repaired.length
            ),

          'X-Duration':
            String(
              duration || 0
            ),
        },

        body: repaired,
      }
    )

  const text =
    await response.text()

  let data = null

  if (text) {
    try {
      data =
        JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    const messageText =
      typeof data === 'object'
        ? (
            data?.message ||
            data?.error ||
            JSON.stringify(data)
          )
        : String(
            data ||
            response.statusText
          )

    throw new Error(
      messageText
    )
  }

  return {
    duration,
    originalSize,
    newSize:
      repaired.length,
    result: data,
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('')
  console.log(
    '============================================'
  )
  console.log(
    ' AUDIO GUESTBOOK — AUDIO REPAIR TOOL'
  )
  console.log(
    '============================================'
  )
  console.log(
    ' MP2 / incompatible audio -> browser MP3'
  )
  console.log(
    '============================================'
  )
  console.log('')

  console.log(
    `API: ${API_URL}`
  )

  console.log(
    `Supabase: ${SUPABASE_URL}`
  )

  console.log(
    `Using saved login: ${REPAIR_EMAIL}`
  )

  console.log('')

  if (
    API_URL.includes(
      'internt-2000'
    )
  ) {
    console.error(
      'WARNING: Old internt-2000 API domain detected.'
    )

    console.error(
      'Update VITE_AUDIO_API_URL in .env.local.'
    )

    console.error('')
  }

  // ==========================================================
  // LOGIN
  // ==========================================================

  console.log(
    'Signing in...'
  )

  const supabase =
    createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    )

  const {
    data,
    error,
  } =
    await supabase.auth
      .signInWithPassword({
        email:
          REPAIR_EMAIL,

        password:
          REPAIR_PASSWORD,
      })

  if (
    error ||
    !data?.session
      ?.access_token
  ) {
    throw new Error(
      error?.message ||
      'Supabase login failed.'
    )
  }

  const token =
    data.session
      .access_token

  console.log(
    'Login successful.'
  )

  // ==========================================================
  // GET EVENTS
  // ==========================================================

  console.log(
    '\nLoading events...'
  )

  const eventsData =
    await apiJson(
      token,
      '/events'
    )

  const events =
    Array.isArray(
      eventsData
    )
      ? eventsData
      : (
          eventsData?.events ||
          []
        )

  if (!events.length) {
    throw new Error(
      'No events were returned by the API.'
    )
  }

  console.log(
    '\nEvents:'
  )

  events.forEach(
    (event, index) => {
      console.log(
        `${String(
          index + 1
        ).padStart(
          2,
          ' '
        )}. ${event.name}  [${event.slug}]`
      )
    }
  )

  // ==========================================================
  // SELECT EVENT
  // ==========================================================

  const eventAnswer =
    (
      await rl.question(
        '\nChoose event number to repair: '
      )
    ).trim()

  const eventIndex =
    Number(
      eventAnswer
    ) - 1

  if (
    !Number.isInteger(
      eventIndex
    ) ||
    eventIndex < 0 ||
    eventIndex >=
      events.length
  ) {
    throw new Error(
      'Invalid event number.'
    )
  }

  const event =
    events[
      eventIndex
    ]

  // ==========================================================
  // GET MESSAGES
  // ==========================================================

  const messagesData =
    await apiJson(
      token,
      `/messages/${encodeURIComponent(
        event.id
      )}`
    )

  const messages =
    Array.isArray(
      messagesData
    )
      ? messagesData
      : (
          messagesData
            ?.messages ||
          []
        )

  if (!messages.length) {
    throw new Error(
      'This event has no active messages.'
    )
  }

  console.log('')
  console.log(
    `Selected: ${event.name}`
  )

  console.log(
    `Messages: ${messages.length}`
  )

  console.log('')
  console.log(
    'Safety behavior:'
  )

  console.log(
    '- Repairs one message at a time.'
  )

  console.log(
    '- Worker creates an R2 backup before replacing the original.'
  )

  console.log(
    '- Existing message ID, filename, label and order are preserved.'
  )

  console.log(
    '- Duration and file size are updated.'
  )

  console.log(
    '- Failed repairs do not stop the remaining messages.'
  )

  // ==========================================================
  // REPAIR MODE
  // ==========================================================

  console.log('')
  console.log(
    'Repair mode:'
  )

  console.log(
    ' 1. Repair ONE message'
  )

  console.log(
    ' 2. Repair ALL messages'
  )

  console.log(
    ' 3. Cancel'
  )

  const mode =
    (
      await rl.question(
        '\nChoose repair mode: '
      )
    ).trim()

  let selectedMessages = []

  // ==========================================================
  // SINGLE MESSAGE MODE
  // ==========================================================

  if (mode === '1') {
    console.log('')
    console.log(
      'Messages:'
    )

    messages.forEach(
      (
        message,
        index
      ) => {
        const label =
          message
            .custom_label ||
          message
            .file_name ||
          `Message ${message.message_number}`

        console.log(
          `${String(
            index + 1
          ).padStart(
            2,
            ' '
          )}. Message ${message.message_number}  ${label}`
        )
      }
    )

    const messageAnswer =
      (
        await rl.question(
          '\nChoose message number from the list above: '
        )
      ).trim()

    const messageIndex =
      Number(
        messageAnswer
      ) - 1

    if (
      !Number.isInteger(
        messageIndex
      ) ||
      messageIndex < 0 ||
      messageIndex >=
        messages.length
    ) {
      throw new Error(
        'Invalid message selection.'
      )
    }

    selectedMessages = [
      messages[
        messageIndex
      ],
    ]

    const selected =
      selectedMessages[0]

    const confirmation =
      (
        await rl.question(
          `Type REPAIR to repair Message ${selected.message_number}: `
        )
      ).trim()

    if (
      confirmation !==
      'REPAIR'
    ) {
      console.log('')
      console.log(
        'Cancelled. No files changed.'
      )

      return
    }
  }

  // ==========================================================
  // ALL MESSAGE MODE
  // ==========================================================

  else if (
    mode === '2'
  ) {
    selectedMessages =
      messages

    console.log('')

    console.log(
      `You are about to repair ${messages.length} recordings.`
    )

    const confirmation =
      (
        await rl.question(
          `Type REPAIR ALL to process all ${messages.length} messages: `
        )
      ).trim()

    if (
      confirmation !==
      'REPAIR ALL'
    ) {
      console.log('')
      console.log(
        'Cancelled. No files changed.'
      )

      return
    }
  }

  // ==========================================================
  // CANCEL
  // ==========================================================

  else {
    console.log('')
    console.log(
      'Cancelled. No files changed.'
    )

    return
  }

  // ==========================================================
  // TEMP DIRECTORY
  // ==========================================================

  const tempDir =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'audio-guestbook-repair-'
      )
    )

  const failures = []

  let repairedCount = 0

  console.log('')
  console.log(
    'Starting repair...'
  )
  console.log('')

  // ==========================================================
  // REPAIR SELECTED MESSAGES
  // ==========================================================

  try {
    for (
      let index = 0;
      index <
      selectedMessages.length;
      index += 1
    ) {
      const message =
        selectedMessages[
          index
        ]

      const label =
        message
          .custom_label ||
        message
          .file_name ||
        `Message ${message.message_number}`

      process.stdout.write(
        `[${index + 1}/${selectedMessages.length}] ${label} ... `
      )

      try {
        const result =
          await repairMessage(
            token,
            message,
            tempDir
          )

        repairedCount += 1

        const oldKb =
          Math.round(
            result
              .originalSize /
            1024
          )

        const newKb =
          Math.round(
            result.newSize /
            1024
          )

        const durationText =
          result.duration
            ? `${result.duration}s`
            : 'duration unknown'

        console.log(
          `OK  ${durationText}  ${oldKb}KB -> ${newKb}KB`
        )
      } catch (error) {
        const errorMessage =
          error?.message ||
          String(error)

        failures.push({
          message,
          error:
            errorMessage,
        })

        console.log(
          `FAILED: ${errorMessage}`
        )
      }
    }
  } finally {
    // ========================================================
    // CLEAN TEMP FILES
    // ========================================================

    fs.rmSync(
      tempDir,
      {
        recursive: true,
        force: true,
      }
    )

    await supabase.auth
      .signOut()
      .catch(
        () => {}
      )
  }

  // ==========================================================
  // RESULTS
  // ==========================================================

  console.log('')
  console.log(
    '============================================'
  )

  console.log(
    ' REPAIR COMPLETE'
  )

  console.log(
    '============================================'
  )

  console.log(
    `Repaired: ${repairedCount}/${selectedMessages.length}`
  )

  if (
    failures.length
  ) {
    console.log(
      `Failed: ${failures.length}`
    )

    console.log('')

    for (
      const item of
      failures
    ) {
      console.log(
        `- Message ${item.message.message_number}: ${item.error}`
      )
    }
  } else {
    console.log(
      'All selected recordings repaired successfully.'
    )
  }

  console.log(
    '============================================'
  )

  console.log('')
}

// ============================================================
// START
// ============================================================

main()
  .catch(
    (error) => {
      console.error('')
      console.error(
        '============================================'
      )

      console.error(
        ' REPAIR TOOL STOPPED'
      )

      console.error(
        '============================================'
      )

      console.error(
        error?.message ||
        error
      )

      console.error('')

      process.exitCode = 1
    }
  )
  .finally(
    () => {
      rl.close()
    }
  )