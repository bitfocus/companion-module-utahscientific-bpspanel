import { RCP3Router, LockType } from './rcp3/index.js'
import { RCP3_ALL_LEVELS_MASK } from './rcp3/protocol.js'
import { ModuleConfig } from './config.js'
import { UtahScientificInstance } from './main.js'
import { InstanceStatus } from '@companion-module/base'

export interface LevelChoice {
	id: number
	label: string
}

export interface SelectedLevel {
	id: number
	enabled: boolean
}

export interface RouterState {
	selectedSource: number
	selectedDestination: number
	sourceNames: Array<{ id: number; label: string }>
	destinationNames: Array<{ id: number; label: string }>
	routes: Map<number, number[]> // destination (1-based) → sources per level (0-indexed = level 1)
	locks: Array<boolean | undefined>
	levels: LevelChoice[]
	selectedLevels: SelectedLevel[]
	numLevels: number
	routerInfo: {
		maxSources: number
		maxDestinations: number
	}
}

export class UtahScientificAPI {
	private rcpRouter: RCP3Router
	private config: ModuleConfig
	private instance: UtahScientificInstance
	private keepAliveInterval?: NodeJS.Timeout
	private reconnectTimer?: NodeJS.Timeout
	private reconnectAttempt = 0
	private isDestroyed = false
	private connected = false
	public state: RouterState

	constructor(config: ModuleConfig, instance: UtahScientificInstance) {
		this.rcpRouter = new RCP3Router()
		this.config = config
		this.instance = instance

		const numLevels = config.levels || 1

		this.state = {
			selectedSource: -1,
			selectedDestination: -1,
			sourceNames: [],
			destinationNames: [],
			routes: new Map(),
			locks: [],
			levels: [],
			selectedLevels: [],
			numLevels,
			routerInfo: {
				maxDestinations: 0,
				maxSources: 0,
			},
		}

		this.initLevels(numLevels)
	}

	private initLevels(numLevels: number): void {
		this.state.levels = []
		this.state.selectedLevels = []
		for (let i = 1; i <= numLevels; i++) {
			this.state.levels.push({ id: i, label: `Level ${i}` })
			this.state.selectedLevels.push({ id: i, enabled: true })
		}
	}

	async connect(): Promise<void> {
		if (this.isDestroyed) return
		this.setupEventHandlers()

		try {
			await this.rcpRouter.connect({
				host: this.config.host,
				port: this.config.port,
			})
			this.connected = true
			this.instance.updateStatus(InstanceStatus.Ok)
			this.reconnectAttempt = 0 // Reset attempt counter on success
			this.state.routerInfo = await this.rcpRouter.getRouterInfo()

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
			this.connected = false
			const errorMessage = error instanceof Error ? error.message : String(error)
			this.instance.log('error', `Connection failed: ${errorMessage}`)
			this.instance.updateStatus(InstanceStatus.ConnectionFailure, errorMessage)
			this.scheduleReconnect()
		}
	}

	private setupEventHandlers(): void {
		// Ensure only one set of listeners exists per RCP-3 router instance
		this.rcpRouter.removeAllListeners()

		this.rcpRouter.on('status', (output, input, levelMask) => {
			// Update routes for each level indicated by the bitmask
			const destLevels = this.state.routes.get(output) ?? new Array(32).fill(-1)
			for (let lvl = 0; lvl < this.state.numLevels; lvl++) {
				if (levelMask & (1 << lvl)) {
					destLevels[lvl] = input
				}
			}
			this.state.routes.set(output, destLevels)

			// Update variables for each affected level
			const sourceName =
				input < 0 ? 'None' : (this.state.sourceNames.find((source) => source.id === input)?.label ?? 'Unknown')
			const sourceIdValue = input < 0 ? 'None' : input
			for (let lvl = 0; lvl < this.state.numLevels; lvl++) {
				if (levelMask & (1 << lvl)) {
					const levelNum = lvl + 1
					this.instance.setVariableValues({
						[`route_${output}_${levelNum}`]: sourceIdValue,
					})
				}
			}

			// Also update the legacy single-level variable (level 1)
			if (levelMask & 1) {
				this.instance.setVariableValues({
					[`destination_${output}_source_id`]: sourceIdValue,
					[`destination_${output}_source_name`]: sourceName,
				})
			}

			this.instance.checkFeedbacks('source_dest_route')
		})
		this.rcpRouter.on('lock', (output, locked) => {
			const isLocked = locked?.isLocked
			this.state.locks[output] = isLocked
			this.instance.setVariableValues({ [`destination_${output}_lock_state`]: isLocked ? 'Locked' : 'Unlocked' })
			this.instance.checkFeedbacks('destination_locked')
		})
		this.rcpRouter.on('disconnect', () => {
			this.connected = false
			this.instance.log('warn', 'Router disconnected')
			this.instance.updateStatus(InstanceStatus.Disconnected)
			this.scheduleReconnect()
		})
		this.rcpRouter.on('error', (error: unknown) => {
			const errorMessage = error instanceof Error ? error.message : String(error)
			if (this.connected) {
				this.instance.log('error', `Router error: ${errorMessage}`)
			}
			this.instance.updateStatus(InstanceStatus.ConnectionFailure)

			if (!this.connected) {
				this.scheduleReconnect()
			}
		})
		this.rcpRouter.on('connected', () => {
			this.connected = true
			this.instance.log('info', 'Router connected')
			this.instance.updateStatus(InstanceStatus.Ok)
		})
		this.rcpRouter.on('reconnect', () => {
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
				await this.rcpRouter.getRouterInfo()
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				// Overlapping keep-alive ticks supersede the prior STATUS request; not a failure.
				if (errorMessage === 'Superseded') return
				this.instance.updateStatus(InstanceStatus.ConnectionFailure)
				this.instance.log('debug', `Keep-alive ping failed: ${errorMessage}`)
				if (this.keepAliveInterval) {
					clearInterval(this.keepAliveInterval)
					this.keepAliveInterval = undefined
				}
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
		this.rcpRouter.removeAllListeners()
		await this.rcpRouter.disconnect()
	}

	//Statuses
	async getCurrentRoutes(): Promise<void> {
		try {
			const statuses = await this.rcpRouter.getStatuses(0, this.state.routerInfo.maxDestinations)
			this.state.routes = statuses
		} catch (e) {
			this.instance.log('warn', `Failed to get current routes: ${e}`)
		}
	}

	async getLockStatuses(): Promise<Array<boolean | undefined>> {
		try {
			const { startDest, locks: allLocks } = await this.rcpRouter.getLockStatuses(
				0,
				this.state.routerInfo.maxDestinations,
			)

			// Reset locks array
			this.state.locks = new Array(this.state.routerInfo.maxDestinations).fill(false)

			for (let i = 0; i < allLocks.length; i++) {
				const destId = startDest + i
				const isLocked = allLocks[i].isLocked

				this.state.locks[destId] = isLocked
				this.instance.setVariableValues({ [`destination_${destId}_lock_state`]: isLocked ? 'Locked' : 'Unlocked' })
			}
		} catch (e) {
			this.instance.log('warn', `Failed to fetch all locks: ${e}`)
		}
		this.instance.checkFeedbacks('destination_locked')
		return this.state.locks
	}

	async updateSourceNames(): Promise<Array<{ id: number; label: string }>> {
		try {
			const names = await this.rcpRouter.getSourceNames()
			this.state.sourceNames = Array.from(names.entries()).map(([id, name]) => ({ id, label: name }))
		} catch (e) {
			this.instance.log('warn', `Failed to update source names: ${e}`)
		}
		return this.state.sourceNames
	}

	async updateDestinationNames(): Promise<Array<{ id: number; label: string }>> {
		try {
			const names = await this.rcpRouter.getDestinationNames()
			this.state.destinationNames = Array.from(names.entries()).map(([id, name]) => ({ id, label: name }))
		} catch (e) {
			this.instance.log('warn', `Failed to update destination names: ${e}`)
		}
		return this.state.destinationNames
	}

	// --- Level Selection ---

	buildLevelMask(): number {
		let mask = 0
		for (const level of this.state.selectedLevels) {
			if (level.enabled) {
				mask |= 1 << (level.id - 1)
			}
		}
		return mask >>> 0
	}

	/**
	 * Bitmask for route-style actions.
	 * - `all`: all 32 RCP-3 level bits (not limited to the instance “number of levels” config).
	 * - `selected`: explicit 1-based level IDs from a multidropdown.
	 */
	buildLevelMaskForRoute(mode: 'all' | 'selected', selectedLevelIds: number[]): number {
		if (mode === 'all') {
			return RCP3_ALL_LEVELS_MASK >>> 0
		}
		let mask = 0
		for (const id of selectedLevelIds) {
			mask |= 1 << (id - 1)
		}
		return mask >>> 0
	}

	selectLevels(levelIds: number[]): void {
		for (const id of levelIds) {
			const level = this.state.selectedLevels.find((l) => l.id === id)
			if (level) level.enabled = true
		}
		this.instance.checkFeedbacks('selected_level', 'source_dest_route')
	}

	deselectLevels(levelIds: number[]): void {
		for (const id of levelIds) {
			const level = this.state.selectedLevels.find((l) => l.id === id)
			if (level) level.enabled = false
		}
		this.instance.checkFeedbacks('selected_level', 'source_dest_route')
	}

	toggleLevels(levelIds: number[]): void {
		for (const id of levelIds) {
			const level = this.state.selectedLevels.find((l) => l.id === id)
			if (level) level.enabled = !level.enabled
		}
		this.instance.checkFeedbacks('selected_level', 'source_dest_route')
	}

	// --- Route Helpers ---

	getSourceForDestLevel(dest: number, level: number): number {
		const levels = this.state.routes.get(dest)
		if (!levels) return -1
		return levels[level - 1] ?? -1
	}

	hasSourceRoutedToDestOnAnySelectedLevel(dest: number, sourceId: number): boolean {
		const levels = this.state.routes.get(dest)
		if (!levels) return false
		for (const sl of this.state.selectedLevels) {
			if (sl.enabled && levels[sl.id - 1] === sourceId) {
				return true
			}
		}
		return false
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
			await this.rcpRouter.setLock(destination, status)
			const lockState = await this.rcpRouter.getLock(destination)
			this.state.locks[destination] = lockState?.isLocked || false
			this.instance.checkFeedbacks('destination_locked')
			this.instance.setVariableValues({
				[`destination_${destination}_lock_state`]: this.state.locks[destination] ? 'Locked' : 'Unlocked',
			})
		} catch (e) {
			this.instance.log('warn', `Failed to set/fetch lock status: ${e}`)
		}
	}

	async take(input: number, output: number, levelMask: number): Promise<void> {
		if (this.state.locks[output]) {
			const msg = `Cannot route to destination ${output} because it is locked`
			this.instance.log('warn', msg)
			throw new Error(msg)
		}

		if (levelMask >>> 0 === 0) {
			const msg = 'Level mask is empty; select at least one level'
			this.instance.log('warn', msg)
			throw new Error(msg)
		}

		try {
			const ok = await this.rcpRouter.take(input, output, levelMask)
			if (!ok) throw new Error('Not connected or send failed')
			this.instance.log('debug', `Routed source ${input} to destination ${output} (levels: ${levelMask})`)
			this.state.selectedSource = -1
			this.instance.setVariableValues({ source: 'None' })
			this.instance.checkFeedbacks('selected_source', 'selected_dest', 'source_dest_route')
		} catch (error) {
			this.instance.log('warn', `Failed to route source ${input} to destination ${output}: ${error}`)
			throw error
		}
	}
}
