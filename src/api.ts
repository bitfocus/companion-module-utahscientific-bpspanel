import { UtahScientificRouter } from 'utahscientific-rscp'
import { ModuleConfig } from './config.js'
import { UtahScientificInstance } from './main.js'
import { InstanceStatus } from '@companion-module/base'

export interface RouterState {
	selectedSource: number
	selectedDestination: number
	sourceNames: Array<{ id: number; label: string }>
	destinationNames: Array<{ id: number; label: string }>
	routes: Array<number>
}

export class UtahScientificAPI {
	private router: UtahScientificRouter
	private config: ModuleConfig
	private instance: UtahScientificInstance
	private keepAliveInterval?: NodeJS.Timeout
	public state: RouterState

	constructor(config: ModuleConfig, instance: UtahScientificInstance) {
		this.router = new UtahScientificRouter()
		this.config = config
		this.instance = instance
		this.state = {
			selectedSource: -1,
			selectedDestination: -1,
			sourceNames: [],
			destinationNames: [],
			routes: [],
		}
	}

	async connect(): Promise<void> {
		// Attach event handlers early so connection errors are caught and logged
		this.setupEventHandlers()

		await this.router.connect({
			host: this.config.host,
			port: this.config.port,
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
		this.startKeepAlive()
	}

	private setupEventHandlers(): void {
		// Ensure only one set of listeners exists per router instance
		this.router.removeAllListeners()

		this.router.on('status', async (_output, _input, _level) => {
			await this.getCurrentRoutes()
			this.instance.checkFeedbacks('source_dest_route')
			this.instance.updateVariables()
		})
		this.router.on('disconnect', () => {
			this.instance.log('warn', 'Router disconnected')
		})
		this.router.on('error', (error: unknown) => {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.instance.log('error', `Router error: ${errorMessage}`)
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
				const errorMessage = error instanceof Error ? error.message : String(error)
				this.instance.log('debug', `Keep-alive ping failed: ${errorMessage}`)
			}
		}, 5000)
	}

	async disconnect(): Promise<void> {
		if (this.keepAliveInterval) {
			clearInterval(this.keepAliveInterval)
			this.keepAliveInterval = undefined
		}
		this.router.removeAllListeners()
		await this.router.disconnect()
	}

	//Statuses
	async getCurrentRoutes(): Promise<Array<number>> {
		const statuses = await this.router.getStatuses(1, 20)
		this.state.routes = statuses
		return this.state.routes
	}

	async updateSourceNames(): Promise<Array<{ id: number; label: string }>> {
		const names = await this.router.getSourceNames()
		this.state.sourceNames = Array.from(names.entries()).map(([id, name]) => ({ id, label: name }))
		return this.state.sourceNames
	}

	async updateDestinationNames(): Promise<Array<{ id: number; label: string }>> {
		const names = await this.router.getDestinationNames()
		this.state.destinationNames = Array.from(names.entries()).map(([id, name]) => ({ id, label: name }))
		return this.state.destinationNames
	}

	//Commands
	selectSource(source: number): void {
		this.state.selectedSource = source
		this.instance.setVariableValues({ source: source })
		this.instance.checkFeedbacks('selected_source')
	}

	selectDestination(destination: number): void {
		this.state.selectedDestination = destination
		this.instance.setVariableValues({ destination: destination })
		this.instance.checkFeedbacks('selected_dest')
	}

	async take(input: number, output: number, level: number): Promise<void> {
		await this.router.take(input, output, level)
	}
}
