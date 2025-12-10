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
	private reconnectTimer?: NodeJS.Timeout
	private reconnectAttempt = 0
	private isDestroyed = false
	private connected = false
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
		if (this.isDestroyed) return
		this.setupEventHandlers()

		try {
			await this.router.connect({
				host: this.config.host,
				port: this.config.port,
				protocol: 'RCP-3',
				options: {
					//debug: true,
				},
			})
			this.connected = true
			this.instance.updateStatus(InstanceStatus.Ok)
			this.reconnectAttempt = 0 // Reset attempt counter on success
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
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			if (this.connected) {
				this.instance.log('error', `Connection failed: ${errorMessage}`)
			}
			this.instance.updateStatus(InstanceStatus.ConnectionFailure, errorMessage)
			this.scheduleReconnect()
		}
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
			this.connected = false
			this.instance.log('warn', 'Router disconnected')
			this.instance.updateStatus(InstanceStatus.Disconnected)
			this.scheduleReconnect()
		})
		this.router.on('error', (error: unknown) => {
			const errorMessage = error instanceof Error ? error.message : String(error)
			if (this.connected) {
				this.instance.log('error', `Router error: ${errorMessage}`)
			}
			this.instance.updateStatus(InstanceStatus.ConnectionFailure)

			if (!this.connected) {
				this.scheduleReconnect()
			}
		})
		this.router.on('connect', () => {
			this.connected = true
			this.instance.log('info', 'Router connected')
			this.instance.updateStatus(InstanceStatus.Ok)
		})
		this.router.on('reconnect', () => {
			this.instance.log('info', 'Router reconnected')
		})
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer || this.isDestroyed) return

		const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), 30000) // Backoff: 1s, 2s, 4s... max 30s
		this.reconnectAttempt++

		this.instance.log('debug', `Reconnecting in ${delay / 1000}s (Attempt ${this.reconnectAttempt})...`)
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = undefined
			this.connect().catch((e) => {
				this.instance.log('debug', `Reconnection attempt failed: ${e}`)
			})
		}, delay)
	}

	private startKeepAlive(): void {
		if (this.keepAliveInterval) clearInterval(this.keepAliveInterval)

		this.keepAliveInterval = setInterval(async () => {
			if (this.isDestroyed) return
			try {
				await this.router.getRouterInfo()
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				this.instance.updateStatus(InstanceStatus.ConnectionFailure)
				this.instance.log('debug', `Keep-alive ping failed: ${errorMessage}`)
				this.scheduleReconnect()
			}
		}, 5000)
	}

	async disconnect(): Promise<void> {
		this.isDestroyed = true
		if (this.keepAliveInterval) {
			clearInterval(this.keepAliveInterval)
			this.keepAliveInterval = undefined
		}
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = undefined
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
			this.instance.log('warn', `Failed to get current routes: ${e}`)
		}
		return this.state.routes
	}

	async getLockStatuses(): Promise<Array<boolean | undefined>> {
		try {
			const allLocks = await this.router.getLockStatuses(1, this.state.routerInfo.maxDestinations)

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
			this.instance.log('warn', `Failed to update source names: ${e}`)
		}
		return this.state.sourceNames
	}

	async updateDestinationNames(): Promise<Array<{ id: number; label: string }>> {
		try {
			const names = await this.router.getDestinationNames()
			this.state.destinationNames = Array.from(names.entries()).map(([id, name]) => ({ id, label: name }))
		} catch (e) {
			this.instance.log('warn', `Failed to update destination names: ${e}`)
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
		this.instance.checkFeedbacks('selected_dest', 'source_dest_route')
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
		if (this.state.locks[output - 1]) {
			this.instance.log('warn', `Cannot route to destination ${output} because it is locked`)
			return
		}

		try {
			const success = await this.router.take(input, output, level)
			if (!success) {
				this.instance.log('warn', `Router reported failed take for input ${input} to output ${output}`)
				return
			}

			// Verify the route actually happened
			const currentInput = await this.router.getStatus(output)
			if (currentInput !== input) {
				this.instance.log(
					'warn',
					`Route verification failed: Expected input ${input} for output ${output}, but got ${currentInput}`,
				)
				return
			}

			this.state.selectedSource = -1
			this.instance.setVariableValues({
				source: -1,
			})
			this.instance.checkFeedbacks('selected_source', 'selected_dest', 'source_dest_route')
		} catch (error) {
			this.instance.log('warn', `Failed to take route: ${error}`)
		}
	}
}
