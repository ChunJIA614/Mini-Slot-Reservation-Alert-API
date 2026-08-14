import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryDirectory = resolve(frontendDirectory, '..')
const viteEntry = join(frontendDirectory, 'node_modules', 'vite', 'bin', 'vite.js')

const api = spawn(
  'dotnet',
  [
    'run',
    '--project',
    'src/MiniSlotReservation.Api/MiniSlotReservation.Api.csproj',
    '--urls',
    'http://localhost:5050',
  ],
  {
    cwd: repositoryDirectory,
    stdio: 'inherit',
    windowsHide: true,
  },
)

const frontend = spawn(process.execPath, [viteEntry], {
  cwd: frontendDirectory,
  stdio: 'inherit',
  windowsHide: true,
})

let isShuttingDown = false

function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true
  api.kill()
  frontend.kill()
  process.exitCode = exitCode
}

api.on('error', (error) => {
  console.error(`Unable to start the ASP.NET API: ${error.message}`)
  shutdown(1)
})

frontend.on('error', (error) => {
  console.error(`Unable to start the Vite frontend: ${error.message}`)
  shutdown(1)
})

api.on('exit', (code) => shutdown(code ?? 1))
frontend.on('exit', (code) => shutdown(code ?? 1))

process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())

