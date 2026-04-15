import express, { Application } from 'express'
import cors from 'cors'
import compression from 'compression'
import path from 'path'
import { fileURLToPath } from 'url'
import 'express-async-errors'
import { env } from './config/env'
import { errorHandler } from './middleware/errorHandler'
import { httpLogger } from './middleware/logger'
import { systemRouter } from './modules/system'
// Domain modules
import authRouter from './modules/auth'
import usersRouter from './modules/users'
import departmentsRouter from './modules/departments'
import strategiesRouter from './modules/strategies'
import plansRouter from './modules/plans'
import tasksRouter from './modules/tasks'
import assessmentsRouter from './modules/assessments'
import dashboardRouter from './modules/dashboard'
import weeklyReportsRouter from './modules/weekly-reports'
import issuesRouter from './modules/issues'
import executionRouter from './modules/execution'
import planningRouter from './modules/planning'
import tasksV2Router from './modules/tasks-v2'
import settingsRouter from './modules/settings'
import backupRouter from './modules/backup'
import changeRequestsRouter from './modules/change-requests'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const createApp = (): Application => {
  const app = express()

  // HTTP request logging
  app.use(httpLogger)

  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN,
      credentials: env.CORS_ORIGIN !== '*',
    })
  )

  // Body parsing and compression
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(compression())

  // API routes - System & Health
  app.use(env.API_PREFIX, systemRouter)

  // API routes - Domain modules
  app.use(`${env.API_PREFIX}/auth`, authRouter)
  app.use(`${env.API_PREFIX}/users`, usersRouter)
  app.use(`${env.API_PREFIX}/departments`, departmentsRouter)
  app.use(`${env.API_PREFIX}/strategies`, strategiesRouter)
  app.use(`${env.API_PREFIX}/plans`, plansRouter)
  app.use(`${env.API_PREFIX}/tasks`, tasksRouter)
  app.use(`${env.API_PREFIX}/tasks-v2`, tasksV2Router)
  app.use(`${env.API_PREFIX}/assessments`, assessmentsRouter)
  app.use(`${env.API_PREFIX}/dashboard`, dashboardRouter)
  app.use(`${env.API_PREFIX}/weekly-reports`, weeklyReportsRouter)
  app.use(`${env.API_PREFIX}/issues`, issuesRouter)
  app.use(`${env.API_PREFIX}/execution`, executionRouter)
  app.use(`${env.API_PREFIX}/planning`, planningRouter)
  app.use(`${env.API_PREFIX}/settings`, settingsRouter)
  app.use(`${env.API_PREFIX}/backup`, backupRouter)
  app.use(`${env.API_PREFIX}/change-requests`, changeRequestsRouter)

  // Serve frontend static files
  const frontendPath = path.join(__dirname, '../../frontend/dist')
  app.use(express.static(frontendPath))
  
  // SPA fallback - send index.html for all non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith(env.API_PREFIX)) {
      return next()
    }
    res.sendFile(path.join(frontendPath, 'index.html'))
  })

  // Error handling
  app.use(errorHandler)

  return app
}
