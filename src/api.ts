import { UtahScientificRouter } from 'utahscientific-rscp'
import { ModuleConfig } from './config.js'
import { UtahScientificInstance } from './main.js'
import { InstanceStatus } from '@companion-module/base'

export class UtahScientificAPI {
	private router: UtahScientificRouter
	private config: ModuleConfig
	private instance: UtahScientificInstance
	private keepAliveInterval?: NodeJS.Timeout
	public selectedSource: number
	public selectedDestination: number
	public sourceNames: Array<{ id: number; label: string }>
	public destinationNames: Array<{ id: number; label: string }>
	public status: Array<number>

	constructor(config: ModuleConfig, instance: UtahScientificInstance) {
		this.router = new UtahScientificRouter()
		this.config = config
		this.instance = instance
		this.selectedSource = -1
		this.selectedDestination = -1
		this.sourceNames = []
		this.destinationNames = []
		this.status = []
	}

	async connect() {
		await this.router.connect({
			host: this.config.host as string,
			port: this.config.port as number,
			protocol: 'RCP-3',
			options: {
				//debug: true,
			},
		})
		this.instance.updateStatus(InstanceStatus.Ok)
		await this.router.getRouterInfo()

		// Parallelize independent operations
		await Promise.all([this.getCurrentRoutes(), this.updateSourceNames(), this.updateDestinationNames()])
		this.instance.updateModuleComponents()

		this.setupEventHandlers()
		this.startKeepAlive()
	}

	private setupEventHandlers(): void {
		this.router.on('status', async (_output, _input, _level) => {
			await this.getCurrentRoutes()
			this.instance.checkFeedbacks('source_dest_route')
			this.instance.updateVariables()
		})
		this.router.on('disconnect', () => {
			this.instance.log('warn', 'Router disconnected')
		})
		this.router.on('error', (error) => {
			this.instance.log('error', `Router error: ${error}`)
		})
		this.router.on('connect', () => {
			this.instance.log('info', 'Router connected')
		})
		this.router.on('reconnect', () => {
			this.instance.log('debug', 'Router reconnected')
		})
	}

	private startKeepAlive(): void {
		this.keepAliveInterval = setInterval(async () => {
			try {
				await this.router.getRouterInfo()
			} catch (error) {
				this.instance.log('debug', `Keep-alive ping failed: ${error}`)
			}
		}, 5000)
	}

	async disconnect() {
		if (this.keepAliveInterval) {
			clearInterval(this.keepAliveInterval)
			this.keepAliveInterval = undefined
		}
		this.router.removeAllListeners()
		await this.router.disconnect()
	}

	//Statuses
	async getCurrentRoutes() {
		const statuses = await this.router.getStatuses(1, 20)
		console.log(statuses)
		this.status = statuses
		return this.status
	}

	currentRoutes() {
		return this.status
	}

	getSelectedSource() {
		return this.selectedSource
	}

	getSelectedDestination() {
		return this.selectedDestination
	}

	async updateSourceNames() {
		const names = await this.router.getSourceNames()
		this.sourceNames = Array.from(names.entries()).map(([id, name]) => ({ id, label: name }))
		return this.sourceNames
	}

	getSourceNames() {
		return this.sourceNames
	}

	async updateDestinationNames() {
		const names = await this.router.getDestinationNames()
		this.destinationNames = Array.from(names.entries()).map(([id, name]) => ({ id, label: name }))
		return this.destinationNames
	}

	getDestinationNames() {
		return this.destinationNames
	}

	//Commands
	selectSource(source: number) {
		this.selectedSource = source
		this.instance.setVariableValues({ source: source })
		this.instance.checkFeedbacks('selected_source')
	}

	selectDestination(destination: number) {
		this.selectedDestination = destination
		this.instance.setVariableValues({ destination: destination })
		this.instance.checkFeedbacks('selected_dest')
	}

	async take(input: number, output: number, level: number) {
		await this.router.take(input, output, level)
	}
}
