import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import ffmpegPath from 'ffmpeg-static'

// ============================================================
// CONFIGURATION
// ============================================================

const API_URL =
  process.env.AUDIO_API_URL ||
  'https://audio-guestbook-api.internt-2000.workers.dev'

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY

// ============================================================
// TERMINAL
// ============================================================

const rl = readline.createInterface({
  input,
  output,
})

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('')
  console.log('========================================')
  console.log(' Audio Guestbook Repair Tool')
  console.log('========================================')
  console.log('')

  if (!ffmpegPath) {
    throw new Error(
      'ffmpeg-static was not found. Run: npm install --save-dev ffmpeg-static'
    )
  }

  if (!SUPABASE_URL) {
    throw new Error(
      'VITE_SUPABASE_URL was not found in your environment.'
    )
  }

  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY was not found in your environment.'
    )
  }

  console.log('This tool repairs legacy MP2 recordings')
  console.log('by converting them to browser-compatible MP3.')
  console.log('')

  // ----------------------------------------------------------
  // LOGIN
  // ----------------------------------------------------------

const email =
  process.env.REPAIR_EMAIL ||
  (
    await rl.question(
      'Supabase admin email: '
    )
  ).trim()

const password =
  process.env.REPAIR_PASSWORD ||
  await rl.question(
    'Supabase password: '
  )

if (!email) {
  throw new Error(
    'Supabase email is required.'
  )
}

if (!password) {
  throw new Error(
    'Supabase password is required.'
  )
}

if (
  process.env.REPAIR_EMAIL &&
  process.env.REPAIR_PASSWORD
) {
  console.log(
    `Using saved login: ${email}`
  )
}
  console.log('')
  console.log('Signing in...')

  const token =
    await signIn(
      email,
      password
    )

  console.log('Login successful.')
  console.log('')

  // ----------------------------------------------------------
  // EVENTS
  // ----------------------------------------------------------

  const eventsResponse =
    await apiFetch(
      '/events',
      token
    )

  const events =
    eventsResponse.events || []

  if (!events.length) {
    console.log(
      'No events were found.'
    )

    return
  }

  console.log('Events:')

  events.forEach(
    (event, index) => {
      console.log(
        ` ${index + 1}. ${event.name}  [${event.slug}]`
      )
    }
  )

  console.log('')

  const eventAnswer =
    await rl.question(
      'Choose event number to repair: '
    )

  const eventIndex =
    Number(eventAnswer) - 1

  if (
    !Number.isInteger(
      eventIndex
    ) ||
    eventIndex < 0 ||
    eventIndex >=
      events.length
  ) {
    throw new Error(
      'Invalid event selection.'
    )
  }

  const selectedEvent =
    events[eventIndex]

  console.log('')
  console.log(
    `Selected: ${selectedEvent.name}`
  )

  // ----------------------------------------------------------
  // MESSAGES
  // ----------------------------------------------------------

  const messagesResponse =
    await apiFetch(
      `/messages/${encodeURIComponent(
        selectedEvent.id
      )}`,
      token
    )

  const messages =
    messagesResponse.messages ||
    []

  console.log(
    `Messages: ${messages.length}`
  )

  console.log('')

  if (!messages.length) {
    console.log(
      'This event has no recordings.'
    )

    return
  }

  // ----------------------------------------------------------
  // MODE
  // ----------------------------------------------------------

  console.log(
    'What would you like to repair?'
  )

  console.log('')
  console.log(
    ' 1. Repair ONE message'
  )

  console.log(
    ' 2. Repair ALL messages'
  )

  console.log(
    ' 3. Cancel'
  )

  console.log('')

  const mode =
    (
      await rl.question(
        'Choose 1, 2 or 3: '
      )
    ).trim()

  if (mode === '3') {
    console.log('')
    console.log(
      'Repair cancelled.'
    )

    return
  }

  if (mode === '1') {
    await chooseSingleMessage(
      selectedEvent,
      messages,
      token
    )

    return
  }

  if (mode === '2') {
    await repairAllMessages(
      selectedEvent,
      messages,
      token
    )

    return
  }

  throw new Error(
    'Invalid selection.'
  )
}

// ============================================================
// SINGLE MESSAGE MODE
// ============================================================

async function chooseSingleMessage(
  event,
  messages,
  token
) {
  console.log('')
  console.log('Recordings:')
  console.log('')

  messages.forEach(
    (message, index) => {
      const label =
        message.custom_label ||
        `Message ${message.message_number}`

      const file =
        message.file_name ||
        'recording'

      console.log(
        ` ${index + 1}. ${label}  [${file}]`
      )
    }
  )

  console.log('')

  const answer =
    await rl.question(
      'Choose message number to repair: '
    )

  const index =
    Number(answer) - 1

  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >=
      messages.length
  ) {
    throw new Error(
      'Invalid message selection.'
    )
  }

  const message =
    messages[index]

  console.log('')
  console.log(
    '----------------------------------------'
  )

  console.log(
    `Event: ${event.name}`
  )

  console.log(
    `Message: ${
      message.custom_label ||
      `Message ${message.message_number}`
    }`
  )

  console.log(
    `File: ${
      message.file_name ||
      'recording'
    }`
  )

  console.log(
    '----------------------------------------'
  )

  console.log('')

  console.log(
    'Only this ONE recording will be repaired.'
  )

  console.log(
    'The Worker will back up the original R2 file first.'
  )

  console.log('')

  const confirm =
    (
      await rl.question(
        `Type REPAIR to repair Message ${message.message_number}: `
      )
    ).trim()

  if (confirm !== 'REPAIR') {
    console.log('')
    console.log(
      'Repair cancelled.'
    )

    return
  }

  console.log('')

  try {
    const result =
      await repairMessage(
        message,
        token
      )

    console.log('')
    console.log(
      '========================================'
    )

    console.log(
      ' REPAIR SUCCESSFUL'
    )

    console.log(
      '========================================'
    )

    console.log('')

    console.log(
      `Message ${message.message_number} was repaired.`
    )

    console.log(
      `Original size: ${formatBytes(
        result.originalSize
      )}`
    )

    console.log(
      `New size: ${formatBytes(
        result.newSize
      )}`
    )

    if (
      result.duration > 0
    ) {
      console.log(
        `Duration: ${result.duration} seconds`
      )
    }

    console.log('')
    console.log(
      'Now test this message in the public gallery.'
    )
  } catch (error) {
    console.log('')
    console.error(
      'REPAIR FAILED'
    )

    console.error(
      error.message
    )
  }
}

// ============================================================
// ALL MESSAGES MODE
// ============================================================

async function repairAllMessages(
  event,
  messages,
  token
) {
  console.log('')
  console.log(
    'WARNING: ALL recordings in this event will be processed.'
  )

  console.log('')

  console.log(
    `Event: ${event.name}`
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
    '- Database duration/file size are updated.'
  )

  console.log(
    '- Failed recordings do not stop the entire batch.'
  )

  console.log('')

  const confirm =
    (
      await rl.question(
        `Type REPAIR ALL to process all ${messages.length} messages: `
      )
    ).trim()

  if (
    confirm !== 'REPAIR ALL'
  ) {
    console.log('')
    console.log(
      'Bulk repair cancelled.'
    )

    return
  }

  console.log('')

  let repaired = 0
  let failed = 0

  const failures = []

  for (
    let index = 0;
    index < messages.length;
    index += 1
  ) {
    const message =
      messages[index]

    console.log(
      '----------------------------------------'
    )

    console.log(
      `[${index + 1}/${messages.length}] Message ${message.message_number}`
    )

    console.log(
      message.file_name ||
        'recording'
    )

    try {
      const result =
        await repairMessage(
          message,
          token
        )

      repaired += 1

      console.log(
        `SUCCESS - ${formatBytes(
          result.newSize
        )}`
      )
    } catch (error) {
      failed += 1

      failures.push({
        message:
          message.message_number,

        file:
          message.file_name,

        error:
          error.message,
      })

      console.error(
        `FAILED - ${error.message}`
      )
    }

    console.log('')
  }

  console.log('')
  console.log(
    '========================================'
  )

  console.log(
    ' BULK REPAIR COMPLETE'
  )

  console.log(
    '========================================'
  )

  console.log('')

  console.log(
    `Successful: ${repaired}`
  )

  console.log(
    `Failed: ${failed}`
  )

  if (failures.length) {
    console.log('')
    console.log(
      'Failures:'
    )

    failures.forEach(
      (failure) => {
        console.log(
          `Message ${failure.message}: ${failure.file || ''}`
        )

        console.log(
          `  ${failure.error}`
        )
      }
    )
  }
}

// ============================================================
// REPAIR ONE MESSAGE
// ============================================================

async function repairMessage(
  message,
  token
) {
  const tempDirectory =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        'audio-guestbook-repair-'
      )
    )

  const originalPath =
    path.join(
      tempDirectory,
      'original-audio'
    )

  const repairedPath =
    path.join(
      tempDirectory,
      'repaired.mp3'
    )

  try {
    console.log(
      'Downloading original...'
    )

    const audioResponse =
      await fetch(
        `${API_URL}/audio/${encodeURIComponent(
          message.id
        )}?download=1`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      )

    if (!audioResponse.ok) {
      const text =
        await audioResponse.text()

      throw new Error(
        `Download failed (${audioResponse.status}): ${text}`
      )
    }

    const originalBuffer =
      Buffer.from(
        await audioResponse.arrayBuffer()
      )

    if (!originalBuffer.length) {
      throw new Error(
        'Downloaded recording is empty.'
      )
    }

    fs.writeFileSync(
      originalPath,
      originalBuffer
    )

    console.log(
      `Downloaded ${formatBytes(
        originalBuffer.length
      )}`
    )

    console.log(
      'Converting to true MP3...'
    )

    await convertToMp3(
      originalPath,
      repairedPath
    )

    if (
      !fs.existsSync(
        repairedPath
      )
    ) {
      throw new Error(
        'FFmpeg did not create the repaired file.'
      )
    }

    const repairedBuffer =
      fs.readFileSync(
        repairedPath
      )

    if (!repairedBuffer.length) {
      throw new Error(
        'Converted MP3 is empty.'
      )
    }

    console.log(
      `Converted ${formatBytes(
        repairedBuffer.length
      )}`
    )

    const duration =
      await getDuration(
        repairedPath
      )

    console.log(
      `Duration: ${duration.toFixed(
        2
      )} seconds`
    )

    console.log(
      'Uploading repaired MP3...'
    )

    const repairResponse =
      await fetch(
        `${API_URL}/repair/message/${encodeURIComponent(
          message.id
        )}`,
        {
          method:
            'POST',

          headers: {
            Authorization:
              `Bearer ${token}`,

            'Content-Type':
              'audio/mpeg',

            'X-File-Size':
              String(
                repairedBuffer.length
              ),

            'X-Duration':
              String(
                Math.round(
                  duration
                )
              ),
          },

          body:
            repairedBuffer,
        }
      )

    const responseText =
      await repairResponse.text()

    let responseData = null

    try {
      responseData =
        responseText
          ? JSON.parse(
              responseText
            )
          : {}
    } catch {
      responseData = {
        raw:
          responseText,
      }
    }

    if (
      !repairResponse.ok
    ) {
      throw new Error(
        responseData?.error ||
          responseData?.message ||
          responseText ||
          `Repair upload failed (${repairResponse.status})`
      )
    }

    console.log(
      'Repaired recording uploaded.'
    )

    if (
      responseData.backup_key
    ) {
      console.log(
        `Backup: ${responseData.backup_key}`
      )
    }

    return {
      originalSize:
        originalBuffer.length,

      newSize:
        repairedBuffer.length,

      duration:
        Math.round(
          duration
        ),

      response:
        responseData,
    }
  } finally {
    try {
      fs.rmSync(
        tempDirectory,
        {
          recursive: true,
          force: true,
        }
      )
    } catch {
      // Ignore temp cleanup errors.
    }
  }
}

// ============================================================
// FFMPEG CONVERSION
// ============================================================

function convertToMp3(
  inputFile,
  outputFile
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const args = [
        '-y',

        '-i',
        inputFile,

        '-vn',

        '-acodec',
        'libmp3lame',

        '-ar',
        '44100',

        '-ac',
        '1',

        '-b:a',
        '128k',

        outputFile,
      ]

      const process =
        spawn(
          ffmpegPath,
          args,
          {
            stdio: [
              'ignore',
              'ignore',
              'pipe',
            ],
          }
        )

      let errorOutput = ''

      process.stderr.on(
        'data',
        (data) => {
          errorOutput +=
            data.toString()
        }
      )

      process.on(
        'error',
        reject
      )

      process.on(
        'close',
        (code) => {
          if (code === 0) {
            resolve()
            return
          }

          reject(
            new Error(
              `FFmpeg conversion failed with code ${code}.\n${errorOutput}`
            )
          )
        }
      )
    }
  )
}

// ============================================================
// AUDIO DURATION
// ============================================================

function getDuration(
  file
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const args = [
        '-i',
        file,
        '-f',
        'null',
        '-',
      ]

      const process =
        spawn(
          ffmpegPath,
          args,
          {
            stdio: [
              'ignore',
              'ignore',
              'pipe',
            ],
          }
        )

      let output = ''

      process.stderr.on(
        'data',
        (data) => {
          output +=
            data.toString()
        }
      )

      process.on(
        'error',
        reject
      )

      process.on(
        'close',
        () => {
          const matches =
            [
              ...output.matchAll(
                /time=(\d+):(\d+):([\d.]+)/g
              ),
            ]

          if (!matches.length) {
            // Try reading the Duration header.

            const durationMatch =
              output.match(
                /Duration:\s*(\d+):(\d+):([\d.]+)/
              )

            if (
              !durationMatch
            ) {
              resolve(0)
              return
            }

            const hours =
              Number(
                durationMatch[1]
              )

            const minutes =
              Number(
                durationMatch[2]
              )

            const seconds =
              Number(
                durationMatch[3]
              )

            resolve(
              hours * 3600 +
                minutes * 60 +
                seconds
            )

            return
          }

          const match =
            matches[
              matches.length - 1
            ]

          const hours =
            Number(
              match[1]
            )

          const minutes =
            Number(
              match[2]
            )

          const seconds =
            Number(
              match[3]
            )

          resolve(
            hours * 3600 +
              minutes * 60 +
              seconds
          )
        }
      )
    }
  )
}

// ============================================================
// SUPABASE LOGIN
// ============================================================

async function signIn(
  email,
  password
) {
  const response =
    await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method:
          'POST',

        headers: {
          apikey:
            SUPABASE_ANON_KEY,

          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            email,
            password,
          }),
      }
    )

  const text =
    await response.text()

  let data = null

  try {
    data =
      JSON.parse(text)
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new Error(
      data?.error_description ||
        data?.msg ||
        data?.message ||
        `Login failed (${response.status})`
    )
  }

  if (
    !data?.access_token
  ) {
    throw new Error(
      'Supabase did not return an access token.'
    )
  }

  return data.access_token
}

// ============================================================
// API FETCH
// ============================================================

async function apiFetch(
  endpoint,
  token,
  options = {}
) {
  const response =
    await fetch(
      `${API_URL}${endpoint}`,
      {
        ...options,

        headers: {
          Authorization:
            `Bearer ${token}`,

          ...(options.headers ||
            {}),
        },
      }
    )

  const text =
    await response.text()

  let data = null

  try {
    data =
      text
        ? JSON.parse(text)
        : {}
  } catch {
    data = {
      raw: text,
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        text ||
        `API request failed (${response.status})`
    )
  }

  return data
}

// ============================================================
// FORMAT BYTES
// ============================================================

function formatBytes(
  bytes
) {
  const value =
    Number(bytes) || 0

  if (value < 1024) {
    return `${value} B`
  }

  if (
    value <
    1024 * 1024
  ) {
    return `${(
      value / 1024
    ).toFixed(1)} KB`
  }

  return `${(
    value /
    (1024 * 1024)
  ).toFixed(2)} MB`
}

// ============================================================
// START
// ============================================================

main()
  .catch(
    (error) => {
      console.error('')
      console.error(
        '========================================'
      )

      console.error(
        ' ERROR'
      )

      console.error(
        '========================================'
      )

      console.error('')
      console.error(
        error.message
      )

      process.exitCode = 1
    }
  )
  .finally(
    () => {
      rl.close()
    }
  )