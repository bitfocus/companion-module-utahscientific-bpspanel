import { InstanceBase, runEntrypoint, InstanceStatus, SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions, UpdateVariables } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { UtahScientificAPI } from './api.js'

export class UtahScientificInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig // Setup in init()
	router!: UtahScientificAPI

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.updateStatus(InstanceStatus.Connecting)

		if (!this.config.host || !this.config.port) {
			this.log('error', 'Host or port is not configured')
			this.updateStatus(InstanceStatus.BadConfig)
			return
		}

		this.router = new UtahScientificAPI(this.config, this)

		// Start the connection process but don't await it here to prevent init from timing out
		this.connectRouter().catch((e) => {
			this.log('error', `Error connecting to router: ${e}`)
			this.updateStatus(InstanceStatus.ConnectionFailure)
		})
	}

	private async connectRouter(): Promise<void> {
		try {
			await this.router.connect()
			this.updateModuleComponents()
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.log('error', `Failed to connect to router: ${errorMessage}`)
			this.updateStatus(InstanceStatus.ConnectionFailure)
		}
	}

	async destroy(): Promise<void> {
		this.log('debug', 'destroy')
		if (this.router) {
			await this.router.disconnect()
		}
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		const configChanged = this.config.host !== config.host || this.config.port !== config.port
		this.config = config

		if (configChanged) {
			if (this.router) {
				await this.router.disconnect()
			}
			this.updateStatus(InstanceStatus.Connecting)
			try {
				this.router = new UtahScientificAPI(this.config, this)
				await this.router.connect()
				this.updateModuleComponents()
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				this.log('error', `Failed to reconnect with new config: ${errorMessage}`)
				this.updateStatus(InstanceStatus.Disconnected)
			}
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
	}
}

runEntrypoint(UtahScientificInstance, UpgradeScripts)
