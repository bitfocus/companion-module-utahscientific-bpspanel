import { InstanceBase, runEntrypoint, InstanceStatus, SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions, UpdateVariables } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { UtahScientificAPI } from './api.js'
import { toErrorMessage } from './utils.js'

export class UtahScientificInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig
	/** High-level module API (state, actions); not the raw RCP-3 transport. */
	api!: UtahScientificAPI

	constructor(internal: unknown) {
		super(internal)
		this.instanceOptions.disableVariableValidation = true
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.updateStatus(InstanceStatus.Connecting)

		if (!this.config.host || !this.config.port) {
			this.log('error', 'Host or port is not configured')
			this.updateStatus(InstanceStatus.BadConfig)
			return
		}

		this.api = new UtahScientificAPI(this.config, this)

		// Start the connection process but don't await it here to prevent init from timing out
		this.connectRouter().catch((e) => {
			this.log('error', `Error connecting to router: ${e}`)
			this.updateStatus(InstanceStatus.ConnectionFailure)
		})
	}

	private async connectRouter(): Promise<void> {
		try {
			await this.api.connect()
			this.updateModuleComponents()
		} catch (error) {
			this.log('error', `Failed to connect to router: ${toErrorMessage(error)}`)
			this.updateStatus(InstanceStatus.ConnectionFailure)
		}
	}

	async destroy(): Promise<void> {
		this.log('debug', 'destroy')
		if (this.api) {
			await this.api.disconnect()
		}
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		const connectionChanged =
			this.config.host !== config.host || this.config.port !== config.port || this.config.levels !== config.levels
		this.config = config

		if (connectionChanged) {
			if (this.api) {
				await this.api.disconnect()
			}
			this.updateStatus(InstanceStatus.Connecting)
			this.api = new UtahScientificAPI(this.config, this)
			this.connectRouter().catch((e) => {
				this.log('error', `Error reconnecting with new config: ${e}`)
				this.updateStatus(InstanceStatus.ConnectionFailure)
			})
		}
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}
	updateVariables(): void {
		UpdateVariables(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateModuleComponents(): void {
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updateVariables()
		this.updatePresets()
		this.checkFeedbacks('destination_locked', 'route_active', 'source_dest_route')
	}
}

runEntrypoint(UtahScientificInstance, UpgradeScripts)
