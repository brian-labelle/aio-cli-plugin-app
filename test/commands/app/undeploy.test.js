/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const TheCommand = require('../../../src/commands/app/undeploy')
const BaseCommand = require('../../../src/BaseCommand')
const dataMocks = require('../../data-mocks/config-loader')

jest.mock('../../../src/lib/app-helper.js')
const helpers = require('../../../src/lib/app-helper.js')

jest.mock('../../../src/lib/audit-logger.js')
const auditLogger = require('../../../src/lib/audit-logger.js')

jest.mock('../../../src/lib/auth-helper.js')
const authHelper = require('../../../src/lib/auth-helper.js')

const mockFS = require('fs-extra')
jest.mock('fs-extra')

const mockConfigData = {
  app: {
    hasFrontend: true,
    hasBackend: true
  }
}

// mocks
const { stdout } = require('stdout-stderr')
const mockWebLib = require('@adobe/aio-lib-web')
const mockRuntimeLib = require('@adobe/aio-lib-runtime')

const createAppConfig = (aioConfig = {}, appFixtureName = 'legacy-app') => {
  const appConfig = dataMocks(appFixtureName, aioConfig).all
  // change this, dataMocks allows to inject custom configuration
  if (appFixtureName.includes('app')) {
    appConfig.application = { ...appConfig.application, ...aioConfig }
  }
  return appConfig
}

const mockExtRegExcShellPayload = () => {
  const payload = {
    endpoints: {
      other: {
        view: [
          { metadata: {} }
        ]
      }
    }
  }
  helpers.buildExtensionPointPayloadWoMetadata.mockReturnValueOnce(payload)
  mockLibConsoleCLI.updateExtensionPoints.mockReturnValueOnce({ endpoints: {} }) // empty delete all
  mockLibConsoleCLI.removeSelectedExtensionPoints.mockReturnValueOnce(payload)
}

const mockLibConsoleCLI = {
  updateExtensionPoints: jest.fn(),
  removeSelectedExtensionPoints: jest.fn()
}

beforeEach(() => {
  mockRuntimeLib.undeployActions.mockReset()
  helpers.runInProcess.mockReset()
  mockFS.existsSync.mockReset()
  helpers.wrapError.mockImplementation(msg => msg)
  auditLogger.getAuditLogEvent.mockImplementation((flags, project, event) => {
    return { orgId: 'mockorg', projectId: 'mockproject', workspaceId: 'mockworkspaceid', workspaceName: 'mockworkspacename' }
  })
  helpers.getCliInfo.mockImplementation(() => {
    return {
      accessToken: 'mocktoken',
      env: 'stage'
    }
  })
  authHelper.setRuntimeApiHostAndAuthHandler.mockImplementation(aioConfig => aioConfig)
  jest.clearAllMocks()
})

test('exports', async () => {
  expect(typeof TheCommand).toEqual('function')
  expect(TheCommand.prototype instanceof BaseCommand).toBeTruthy()
})

test('description', async () => {
  expect(TheCommand.description).toBeDefined()
})

test('aliases', async () => {
  expect(TheCommand.aliases).toEqual([])
})

test('flags', async () => {
  expect(typeof TheCommand.flags.actions).toBe('object')
  expect(typeof TheCommand.flags.actions.description).toBe('string')
  expect(TheCommand.flags.actions.default).toEqual(true)
  expect(TheCommand.flags.actions.allowNo).toEqual(true)

  expect(typeof TheCommand.flags['web-assets']).toBe('object')
  expect(typeof TheCommand.flags['web-assets'].description).toBe('string')
  expect(TheCommand.flags['web-assets'].default).toEqual(true)
  expect(TheCommand.flags['web-assets'].allowNo).toEqual(true)

  expect(typeof TheCommand.flags.extension).toBe('object')
  expect(typeof TheCommand.flags.extension.description).toBe('string')
  expect(TheCommand.flags.extension.multiple).toEqual(true)
  expect(TheCommand.flags.extension.char).toEqual('e')

  expect(typeof TheCommand.flags.unpublish).toBe('object')
  expect(typeof TheCommand.flags.unpublish.description).toBe('string')
  expect(TheCommand.flags.unpublish.default).toEqual(true)
  expect(TheCommand.flags.unpublish.allowNo).toEqual(true)

  expect(typeof TheCommand.flags['force-unpublish']).toBe('object')
  expect(typeof TheCommand.flags['force-unpublish'].description).toBe('string')
  expect(TheCommand.flags['force-unpublish'].default).toEqual(false)
  expect(TheCommand.flags['force-unpublish'].exclusive).toEqual(['unpublish'])
})

/**
 * @param {object} pre pre-undeploy-hook script
 * @param {object} undeployActions undeploy-actions script
 * @param {object} undeployStatic undeploy-static script
 * @param {object} post post-undeploy-hook script
 */
function __setupMockHooks (pre = {}, undeployActions = {}, undeployStatic = {}, post = {}) {
  helpers.runInProcess
    .mockResolvedValueOnce(pre) // pre-app-undeploy
    .mockResolvedValueOnce(undeployActions) // undeploy-actions
    .mockResolvedValueOnce(undeployStatic) // undeploy-static
    .mockResolvedValueOnce(post) // post-app-undeploy
}

describe('run', () => {
  let command
  beforeEach(() => {
    mockFS.existsSync.mockReset()
    command = new TheCommand([])
    command.error = jest.fn()
    command.log = jest.fn()
    command.appConfig = mockConfigData
    command.config = {
      runCommand: jest.fn(),
      runHook: jest.fn()
    }
    command.getLibConsoleCLI = jest.fn(() => mockLibConsoleCLI)
    command.getAppExtConfigs = jest.fn()
    command.getFullConfig = jest.fn().mockReturnValue({
      aio: {
        project: {
          workspace: {
            name: 'foo'
          }
        }
      }
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('undeploy an App with no flags no hooks', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig())

    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(1)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(1)
  })

  test('undeploy an App with no flags with hooks', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig())
    __setupMockHooks()

    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(0)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(0)
  })

  test('pre post undeploy hook errors --no-actions --no-web-assets', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig())

    helpers.runInProcess
      .mockRejectedValueOnce('error-pre-app-undeploy') // pre-app-deploy (logs error)
      .mockRejectedValueOnce('error-post-app-undeploy') // post-app-deploy (logs error)

    command.argv = ['--no-actions', '--no-web-assets']
    await command.run()
    expect(command.error).toHaveBeenCalledTimes(1)
    expect(command.error).toHaveBeenCalledWith('Nothing to be done 🚫')
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(0)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(0)

    expect(command.log).toHaveBeenCalledWith('error-pre-app-undeploy')
    expect(command.log).toHaveBeenCalledWith('error-post-app-undeploy')
  })

  test('undeploy an App with --verbose', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig())

    command.argv = ['-v']
    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(1)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(1)
  })

  test('undeploy no-actions', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig())

    command.argv = ['--no-actions']
    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(0)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(1)
  })

  test('undeploy no-actions verbose', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig())

    command.argv = ['--no-actions', '-v']
    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(0)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(1)
  })

  test('undeploy skip static', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig())

    command.argv = ['--no-web-assets']
    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(1)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(0)
  })

  test('undeploy skip web assets', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig())

    command.argv = ['--no-web-assets']
    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(1)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(0)
  })

  test('undeploy skip static verbose', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig())

    command.argv = ['--no-web-assets', '-v']
    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(1)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(0)
  })

  test('undeploy an app with no backend', async () => {
    const aioConfig = { app: { hasFrontend: true, hasBackend: false } }
    const appConfig = createAppConfig(aioConfig)
    command.getAppExtConfigs.mockResolvedValueOnce(appConfig)

    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(0)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(1)
    expect(command.log).toHaveBeenCalledWith('no manifest file, skipping action undeploy')
  })

  test('undeploy an app with no frontend', async () => {
    const aioConfig = { app: { hasFrontend: false, hasBackend: true } }
    const appConfig = createAppConfig(aioConfig)
    command.getAppExtConfigs.mockResolvedValueOnce(appConfig)

    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(1)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(0)
    expect(command.log).toHaveBeenCalledWith('no frontend, skipping frontend undeploy')
  })

  test('should fail if scripts.undeployActions fails', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig())

    const error = new Error('mock failure Actions')
    mockRuntimeLib.undeployActions.mockRejectedValue(error)

    await expect(command.run()).rejects.toThrow(error)

    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(1)
  })

  test('should fail if scripts.undeployWeb fails', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig())

    const error = new Error('mock failure UI')
    mockWebLib.undeployWeb.mockRejectedValue(error)

    await expect(command.run()).rejects.toThrow(error)

    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(1)
  })

  test('spinner should be called for progress logs on undeployWeb call , with verbose', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig())

    mockRuntimeLib.undeployActions.mockResolvedValue('ok')
    mockWebLib.undeployWeb.mockImplementation(async (config, log) => {
      log('progress log')
      return 'ok'
    })
    command.argv = ['-v']
    await command.run()
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(1)
    expect(stdout.output).toEqual(expect.stringContaining('progress log'))
  })

  test('spinner should be called for progress logs on undeployWeb call , without verbose', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig())

    mockRuntimeLib.undeployActions.mockResolvedValue('ok')
    mockWebLib.undeployWeb.mockImplementation(async (config, log) => {
      log('progress log')
      return 'ok'
    })
    await command.run()
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(1)
  })

  test('publish phase (no force, exc-shell payload)', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig({}, 'app-exc-nui'))
    command.getFullConfig.mockResolvedValue({
      aio: {
        project: {
          workspace: {
            name: 'foo'
          }
        }
      }
    })
    const payload = {
      endpoints: {
        'dx/excshell/1': {
          view: [
            { metadata: {} }
          ]
        }
      }
    }
    helpers.buildExtensionPointPayloadWoMetadata.mockReturnValueOnce(payload)
    mockLibConsoleCLI.removeSelectedExtensionPoints.mockReturnValueOnce(payload)

    command.argv = []
    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(helpers.buildExtensionPointPayloadWoMetadata).toHaveBeenCalledTimes(1)
    expect(mockLibConsoleCLI.updateExtensionPoints).toHaveBeenCalledTimes(0)
    expect(mockLibConsoleCLI.removeSelectedExtensionPoints).toHaveBeenCalledTimes(1)
  })

  test('publish phase (--force-nopublish, no exc-shell payload)', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig({}, 'exc'))
    command.getFullConfig.mockResolvedValue({
      aio: {
        project: {
          workspace: {
            name: 'foo'
          }
        }
      }
    })

    command.argv = ['--force-unpublish']
    mockExtRegExcShellPayload()
    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(helpers.buildExtensionPointPayloadWoMetadata).toHaveBeenCalledTimes(1)
    expect(mockLibConsoleCLI.updateExtensionPoints).toHaveBeenCalledTimes(1)
    expect(mockLibConsoleCLI.removeSelectedExtensionPoints).toHaveBeenCalledTimes(0)
  })

  test('app hook sequence', async () => {
    const appConfig = createAppConfig()
    command.getAppExtConfigs.mockResolvedValueOnce(appConfig)

    // set hooks (command the same as hook name, for easy reference)
    appConfig.application.hooks = {
      'pre-app-undeploy': 'pre-app-undeploy',
      'undeploy-actions': 'undeploy-actions',
      'undeploy-static': 'undeploy-static',
      'post-app-undeploy': 'post-app-undeploy'
    }

    const scriptSequence = []
    helpers.runInProcess.mockImplementation(script => {
      scriptSequence.push(script)
    })

    command.argv = []
    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(1)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(1)

    expect(helpers.runInProcess).toHaveBeenCalledTimes(4)
    expect(scriptSequence.length).toEqual(4)
    expect(scriptSequence[0]).toEqual('pre-app-undeploy')
    expect(scriptSequence[1]).toEqual('undeploy-actions')
    expect(scriptSequence[2]).toEqual('undeploy-static')
    expect(scriptSequence[3]).toEqual('post-app-undeploy')
  })

  test('nothing to be undeployed (--no-publish, --build, --no-deploy)', async () => {
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig())

    command.argv = ['--no-unpublish', '--no-web-assets', '--no-actions']
    await command.run()
    expect(command.error).toHaveBeenCalledTimes(1)
    expect(command.error).toHaveBeenCalledWith(expect.stringMatching(/Nothing to be done/))
  })

  test('does NOT fire `event` hooks when feature flag is NOT enabled', async () => {
    const runHook = jest.fn()
    command.config = { runHook }
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig(command.appConfig))
    command.argv = []
    await command.run()
    expect(command.error).not.toHaveBeenCalled()
    expect(runHook).not.toHaveBeenCalledWith('pre-undeploy-event-reg')
  })

  test('does NOT fire `event` hooks when events flag is false', async () => {
    const runHook = jest.fn()
    command.config = { runHook }
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig(command.appConfig))
    await command.run()
    expect(command.error).not.toHaveBeenCalled()
    expect(runHook).not.toHaveBeenCalledWith('pre-undeploy-event-reg')
  })

  test('DOES fire `event` hooks when feature flag IS enabled', async () => {
    const runHook = jest.fn()
      .mockResolvedValue({
        successes: ['ok'],
        failures: []
      })
    command.config = { runHook }
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig(command.appConfig))
    await command.run()
    expect(command.error).not.toHaveBeenCalled()
    expect(runHook).toHaveBeenCalledWith('pre-undeploy-event-reg', expect.any(Object))
  })

  test('outputs error if events hook throws', async () => {
    const runHook = jest.fn()
      .mockResolvedValue({
        successes: [],
        failures: [{ plugin: { name: 'ifailedu' }, error: 'some error' }]
      })
    command.config = { runHook }
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig(command.appConfig))
    await command.run()
    expect(runHook).toHaveBeenCalledWith('pre-undeploy-event-reg', expect.any(Object))
    expect(command.error).toHaveBeenCalledTimes(1)
  })

  test('Should invoke setRuntimeApiHostAndAuthHandler if IS_DEPLOY_SERVICE_ENABLED = true', async () => {
    const mockOrg = 'mockorg'
    const mockProject = 'mockproject'
    const mockWorkspaceId = 'mockworkspaceid'
    const mockWorkspaceName = 'mockworkspacename'

    process.env.IS_DEPLOY_SERVICE_ENABLED = true

    command.getFullConfig = jest.fn().mockReturnValue({
      aio: {
        project: {
          id: mockProject,
          org: {
            id: mockOrg
          },
          workspace: {
            id: mockWorkspaceId,
            name: mockWorkspaceName
          }
        }
      }
    })
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig(command.appConfig))

    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(1)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(1)
    expect(authHelper.setRuntimeApiHostAndAuthHandler).toHaveBeenCalledTimes(1)
    process.env.IS_DEPLOY_SERVICE_ENABLED = false
  })

  test('Send audit logs for successful app undeploy', async () => {
    const mockToken = 'mocktoken'
    const mockEnv = 'stage'
    const mockOrg = 'mockorg'
    const mockProject = 'mockproject'
    const mockWorkspaceId = 'mockworkspaceid'
    const mockWorkspaceName = 'mockworkspacename'

    command.getFullConfig = jest.fn().mockReturnValue({
      aio: {
        project: {
          id: mockProject,
          org: {
            id: mockOrg
          },
          workspace: {
            id: mockWorkspaceId,
            name: mockWorkspaceName
          }
        }
      }
    })
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig(command.appConfig))

    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(1)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(1)
    expect(auditLogger.sendAuditLogs.mock.calls.length).toBe(1)
    expect(auditLogger.sendAuditLogs).toHaveBeenCalledWith(mockToken, expect.objectContaining({ orgId: mockOrg, projectId: mockProject, workspaceId: mockWorkspaceId, workspaceName: mockWorkspaceName }), mockEnv)
  })

  test('Do not Send audit logs for successful app undeploy if case of no-token', async () => {
    const mockOrg = 'mockorg'
    const mockProject = 'mockproject'
    const mockWorkspaceId = 'mockworkspaceid'
    const mockWorkspaceName = 'mockworkspacename'

    command.getFullConfig = jest.fn().mockReturnValue({
      aio: {
        project: {
          id: mockProject,
          org: {
            id: mockOrg
          },
          workspace: {
            id: mockWorkspaceId,
            name: mockWorkspaceName
          }
        }
      }
    })
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig(command.appConfig))
    helpers.getCliInfo.mockImplementationOnce(() => null)

    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(1)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(1)
    expect(auditLogger.sendAuditLogs.mock.calls.length).toBe(0)
  })

  test('Do not Send audit logs for successful app undeploy, if no logevent is present', async () => {
    const mockOrg = 'mockorg'
    const mockProject = 'mockproject'
    const mockWorkspaceId = 'mockworkspaceid'
    const mockWorkspaceName = 'mockworkspacename'

    command.getFullConfig = jest.fn().mockReturnValue({
      aio: {
        project: {
          id: mockProject,
          org: {
            id: mockOrg
          },
          workspace: {
            id: mockWorkspaceId,
            name: mockWorkspaceName
          }
        }
      }
    })
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig(command.appConfig))

    auditLogger.getAuditLogEvent.mockImplementation((flags, project, event) => null)

    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(1)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(1)
    expect(auditLogger.sendAuditLogs.mock.calls.length).toBe(0)
  })

  test('Should app undeploy successfully even if Audit Log Service is not available', async () => {
    const mockOrg = 'mockorg'
    const mockProject = 'mockproject'
    const mockWorkspaceId = 'mockworkspaceid'
    const mockWorkspaceName = 'mockworkspacename'

    command.getFullConfig = jest.fn().mockReturnValue({
      aio: {
        project: {
          id: mockProject,
          org: {
            id: mockOrg
          },
          workspace: {
            id: mockWorkspaceId,
            name: mockWorkspaceName
          }
        }
      }
    })
    command.getAppExtConfigs.mockResolvedValueOnce(createAppConfig(command.appConfig))

    auditLogger.sendAuditLogs.mockRejectedValue({
      message: 'Internal Server Error',
      status: 500
    })

    await command.run()
    expect(command.error).toHaveBeenCalledTimes(0)
    expect(mockRuntimeLib.undeployActions).toHaveBeenCalledTimes(1)
    expect(mockWebLib.undeployWeb).toHaveBeenCalledTimes(1)
    expect(auditLogger.sendAuditLogs).toHaveBeenCalledTimes(1)
  })
})
