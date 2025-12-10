import { UtahScientificRouter, LockType } from 'utahscientific-rscp'
import { ModuleConfig } from './config.js'
import { UtahScientificInstance } from './main.js'
import { InstanceStatus } from '@companion-module/base'

export interface RouterState {
	selectedSource: number
	selectedDestination: number
	sourceNames: Array<{ id: number; label: string }>
	destinationNames: Array<{ id: number; label: string }>
	routes: Array<number>
	locks: Array<boolean | undefined>
	routerInfo: {
		maxSources: number
		maxDestinations: number
	}
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
			locks: [],
			routerInfo: {
				maxDestinations: 0,
				maxSources: 0,
			},
		}
	}

	async connect(): Promise<void> {
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
		this.state.routerInfo = await this.router.getRouterInfo()

		// Parallelize independent operations
		await Promise.all([
			this.getCurrentRoutes(),
			this.updateSourceNames(),
			this.updateDestinationNames(),
			this.getLockStatuses(),
		])
		this.instance.updateModuleComponents()
		this.startKeepAlive()
	}

	private setupEventHandlers(): void {
		// Ensure only one set of listeners exists per router instance
		this.router.removeAllListeners()

		this.router.on('status', (output, input, _level) => {
			this.state.routes[output] = input

			const sourceName = this.state.sourceNames.find((source) => source.id === input)?.label ?? 'Unknown'
			this.instance.setVariableValues({
				[`destination_${output}_source_id`]: input,
				[`destination_${output}_source_name`]: sourceName,
			})
			this.instance.checkFeedbacks('source_dest_route')
		})
		this.router.on('disconnect', () => {
			this.instance.log('warn', 'Router disconnected')
		})
		this.router.on('error', (error: unknown) => {
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.instance.log('error', `Router error: ${errorMessage}`)
			this.instance.updateStatus(InstanceStatus.ConnectionFailure)
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
				this.instance.updateStatus(InstanceStatus.ConnectionFailure)
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
		try {
			const statuses = await this.router.getStatuses(1, this.state.routerInfo.maxDestinations)
			this.state.routes = statuses
		} catch (e) {
			this.instance.log('error', `Failed to get current routes: ${e}`)
		}
		return this.state.routes
	}

	async getLockStatuses(): Promise<Array<boolean | undefined>> {
		try {
			const allLocks = await this.router.getAllLocks(1, this.state.routerInfo.maxDestinations)

			// Reset locks array
			this.state.locks = new Array(this.state.routerInfo.maxDestinations).fill(false)

			for (let i = 0; i < allLocks.length; i++) {
				const lockItem = allLocks[i]
				const isLocked = lockItem.isLocked

				this.state.locks[i] = isLocked
				this.instance.setVariableValues({ [`destination_${i + 1}_locked`]: isLocked ? 'Locked' : 'Unlocked' })
			}
		} catch (e) {
			this.instance.log('warn', `Failed to fetch all locks: ${e}`)
		}
		this.instance.checkFeedbacks('destination_locked')
		return this.state.locks
	}

	async updateSourceNames(): Promise<Array<{ id: number; label: string }>> {
		try {
			const names = await this.router.getSourceNames()
			this.state.sourceNames = Array.from(names.entries()).map(([id, name]) => ({ id, label: name }))
		} catch (e) {
			this.instance.log('error', `Failed to update source names: ${e}`)
		}
		return this.state.sourceNames
	}

	async updateDestinationNames(): Promise<Array<{ id: number; label: string }>> {
		try {
			const names = await this.router.getDestinationNames()
			this.state.destinationNames = Array.from(names.entries()).map(([id, name]) => ({ id, label: name }))
		} catch (e) {
			this.instance.log('error', `Failed to update destination names: ${e}`)
		}
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

	async setLock(destination: number, lock: boolean): Promise<void> {
		const status = lock ? LockType.Lock : LockType.Unlock
		try {
			await this.router.setLock(destination, status)
			const lockState = await this.router.getLock(destination)
			this.state.locks[destination - 1] = lockState?.isLocked || false
			this.instance.checkFeedbacks('destination_locked')
			this.instance.setVariableValues({
				[`destination_${destination}_locked`]: this.state.locks[destination - 1] ? 'Locked' : 'Unlocked',
			})
		} catch (e) {
			this.instance.log('warn', `Failed to set/fetch lock status: ${e}`)
		}
	}

	async take(input: number, output: number, level: number): Promise<void> {
		try {
			await this.router.take(input, output, level)
			this.state.selectedSource = -1
			this.instance.setVariableValues({
				source: -1,
			})
			this.instance.checkFeedbacks('selected_source')
			this.instance.checkFeedbacks('selected_dest')
		} catch (error) {
			this.instance.log('error', `Failed to take route: ${error}`)
		}
	}
}
