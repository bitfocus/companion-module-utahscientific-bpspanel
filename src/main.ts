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

		this.router = new UtahScientificAPI(this.config, this)
		try {
			await this.router.connect()
			this.updateModuleComponents()
		} catch (error) {
			this.log('error', `Failed to connect to router: ${error}`)
			this.updateStatus(InstanceStatus.Disconnected)
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

		if (configChanged && this.router) {
			this.updateStatus(InstanceStatus.Connecting)
			try {
				await this.router.disconnect()
				this.router = new UtahScientificAPI(this.config, this)
				await this.router.connect()
				this.updateModuleComponents()
			} catch (error) {
				this.log('error', `Failed to reconnect with new config: ${error}`)
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
