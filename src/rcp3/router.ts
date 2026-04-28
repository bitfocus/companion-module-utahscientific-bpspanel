import { EventEmitter } from 'events'
import { RCP3Connection, type RCP3ConnectionOptions } from './connection.js'
import {
	INTF_SC,
	INTF_SC4_LIST,
	INTF_ERR_UNET,
	CMD_TAKE,
	CMD_STATUS,
	CMD_STATUS_RESP,
	CMD_GET_MATRIX,
	CMD_GET_MATRIX_RESP,
	CMD_SET_LOCK,
	CMD_GET_LOCK,
	CMD_GET_LOCK_RESP,
	CMD_CLEAR_LOCK,
	CMD_SYSTEM_TAKE,
	CMD_SYSTEM_LOCK,
	CMD_GET_LIST,
	CMD_GET_LIST_RESP,
	CMD_DEV_TABLE_DONE_OUTPUT,
	CMD_DEV_TABLE_DONE_INPUT,
	GET_MATRIX_ENTRY_SIZE,
	GET_LOCK_ENTRY_SIZE,
	GET_LIST_ENTRY_SIZE,
	LockType,
	type LockStatus,
	type ParsedPacket,
	isErrorInterface,
	getErrorInterfaceName,
	getUnetErrorMessage,
} from './protocol.js'

export interface RouterInfo {
	maxSources: number
	maxDestinations: number
}

interface Deferred<T> {
	resolve: (value: T) => void
	reject: (error: Error) => void
	timer: NodeJS.Timeout
}

export class RCP3Router extends EventEmitter {
	private connection: RCP3Connection
	private pendingRouterInfo: Deferred<RouterInfo> | null = null
	private pendingMatrixRequest:
		| (Deferred<Map<number, number[]>> & {
				expectedCount: number
				startOutput: number
				results: Map<number, number[]>
				receivedCount: number
		  })
		| null = null
	private pendingLockRequest: Deferred<LockStatus[]> | null = null
	private pendingSourceNames: Deferred<Map<number, string>> | null = null
	private pendingDestNames: Deferred<Map<number, string>> | null = null

	// Temporary accumulators for streamed list responses
	private sourceNameAccumulator: Map<number, string> = new Map()
	private destNameAccumulator: Map<number, string> = new Map()

	constructor() {
		super()
		this.connection = new RCP3Connection()
	}

	async connect(options: RCP3ConnectionOptions): Promise<void> {
		this.connection.removeAllListeners()

		this.connection.on('packet', (packet: ParsedPacket) => {
			this.handlePacket(packet)
		})

		this.connection.on('connected', () => {
			this.emit('connected')
		})

		this.connection.on('disconnected', () => {
			this.rejectAllPending('Disconnected')
			this.emit('disconnect')
		})

		this.connection.on('error', (err: Error) => {
			this.emit('error', err)
		})

		await this.connection.connect(options)
	}

	async disconnect(): Promise<void> {
		this.rejectAllPending('Disconnecting')
		this.connection.removeAllListeners()
		await this.connection.disconnect()
	}

	removeAllListeners(event?: string | symbol): this {
		super.removeAllListeners(event)
		return this
	}

	// --- Commands ---

	async take(input: number, output: number, levelMask: number): Promise<boolean> {
		const payload = Buffer.alloc(8)
		payload.writeUInt16BE(input, 0)
		payload.writeUInt16BE(output, 2)
		payload.writeUInt32BE(levelMask >>> 0, 4)

		try {
			this.connection.sendPacket(INTF_SC, CMD_TAKE, payload)
			return true
		} catch {
			return false
		}
	}

	async getRouterInfo(): Promise<RouterInfo> {
		if (this.pendingRouterInfo) {
			this.pendingRouterInfo.reject(new Error('Superseded'))
			clearTimeout(this.pendingRouterInfo.timer)
			this.pendingRouterInfo = null
		}

		return new Promise<RouterInfo>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pendingRouterInfo = null
				reject(new Error('Router info request timeout'))
			}, 2000)

			this.pendingRouterInfo = { resolve, reject, timer }
			this.connection.sendPacket(INTF_SC, CMD_STATUS, Buffer.alloc(0))
		})
	}

	async getStatuses(startOutput: number, count: number): Promise<Map<number, number[]>> {
		if (this.pendingMatrixRequest) {
			this.pendingMatrixRequest.reject(new Error('Superseded'))
			clearTimeout(this.pendingMatrixRequest.timer)
			this.pendingMatrixRequest = null
		}

		return new Promise<Map<number, number[]>>((resolve, reject) => {
			const timer = setTimeout(() => {
				// Resolve with whatever we've accumulated on timeout
				const partial = this.pendingMatrixRequest?.results ?? new Map()
				this.pendingMatrixRequest = null
				resolve(partial)
			}, 2000)

			this.pendingMatrixRequest = {
				resolve,
				reject,
				timer,
				expectedCount: count,
				startOutput,
				results: new Map(),
				receivedCount: 0,
			}

			const payload = Buffer.alloc(4)
			payload.writeUInt16BE(startOutput, 0)
			payload.writeUInt16BE(count, 2)
			this.connection.sendPacket(INTF_SC, CMD_GET_MATRIX, payload)
		})
	}

	async setLock(output: number, lockType: LockType): Promise<void> {
		const payload = Buffer.alloc(12)
		if (lockType === LockType.Lock) {
			payload.writeUInt32BE(0xffffffff, 0) // Lock type mask: all levels
			payload.writeUInt32BE(0xffffffff, 4) // Level mask: all levels
		} else {
			payload.writeUInt32BE(0x00000000, 0) // Unlock
			payload.writeUInt32BE(0xffffffff, 4) // All levels
		}
		payload.writeUInt16BE(output, 8)
		payload.writeUInt16BE(0x0000, 10) // Panel ID

		const cmd = lockType === LockType.Lock ? CMD_SET_LOCK : CMD_CLEAR_LOCK
		this.connection.sendPacket(INTF_SC, cmd, payload)
	}

	async getLock(output: number): Promise<LockStatus | undefined> {
		const locks = await this.getLockStatuses(output, 1)
		return locks[0]
	}

	async getLockStatuses(startOutput: number, count: number): Promise<LockStatus[]> {
		if (this.pendingLockRequest) {
			this.pendingLockRequest.reject(new Error('Superseded'))
			clearTimeout(this.pendingLockRequest.timer)
			this.pendingLockRequest = null
		}

		return new Promise<LockStatus[]>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pendingLockRequest = null
				reject(new Error('GetLock request timeout'))
			}, 5000)

			this.pendingLockRequest = { resolve, reject, timer }

			const payload = Buffer.alloc(4)
			payload.writeUInt16BE(startOutput, 0)
			payload.writeUInt16BE(count, 2)
			this.connection.sendPacket(INTF_SC, CMD_GET_LOCK, payload)
		})
	}

	async getSourceNames(): Promise<Map<number, string>> {
		if (this.pendingSourceNames) {
			this.pendingSourceNames.reject(new Error('Superseded'))
			clearTimeout(this.pendingSourceNames.timer)
			this.pendingSourceNames = null
		}

		this.sourceNameAccumulator = new Map()

		return new Promise<Map<number, string>>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pendingSourceNames = null
				// Resolve with whatever we have so far on timeout
				resolve(this.sourceNameAccumulator)
			}, 10000)

			this.pendingSourceNames = { resolve, reject, timer }

			const payload = Buffer.alloc(1)
			payload[0] = 0x00 // Type: Sources
			this.connection.sendPacket(INTF_SC4_LIST, CMD_GET_LIST, payload)
		})
	}

	async getDestinationNames(): Promise<Map<number, string>> {
		if (this.pendingDestNames) {
			this.pendingDestNames.reject(new Error('Superseded'))
			clearTimeout(this.pendingDestNames.timer)
			this.pendingDestNames = null
		}

		this.destNameAccumulator = new Map()

		return new Promise<Map<number, string>>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pendingDestNames = null
				resolve(this.destNameAccumulator)
			}, 10000)

			this.pendingDestNames = { resolve, reject, timer }

			const payload = Buffer.alloc(1)
			payload[0] = 0x01 // Type: Destinations
			this.connection.sendPacket(INTF_SC4_LIST, CMD_GET_LIST, payload)
		})
	}

	// --- Packet Handler ---

	private handlePacket(packet: ParsedPacket): void {
		const { interfaceId, command, payload } = packet

		// Handle error packets
		if (isErrorInterface(interfaceId)) {
			this.handleErrorPacket(interfaceId, command, payload)
			return
		}

		// Standard SC interface (0x12)
		if (interfaceId === INTF_SC) {
			switch (command) {
				case CMD_STATUS_RESP:
					this.handleStatusResp(payload)
					break
				case CMD_GET_MATRIX_RESP:
					this.handleGetMatrixResp(payload)
					break
				case CMD_GET_LOCK_RESP:
					this.handleGetLockResp(payload)
					break
				case CMD_SYSTEM_TAKE:
					this.handleSystemTake(payload)
					break
				case CMD_SYSTEM_LOCK:
					this.handleSystemLock(payload)
					break
			}
		}

		// SC4 list interface (0x80)
		if (interfaceId === INTF_SC4_LIST) {
			switch (command) {
				case CMD_GET_LIST_RESP:
					this.handleGetListResp(payload)
					break
				case CMD_DEV_TABLE_DONE_INPUT:
					this.handleDevTableDone('source')
					break
				case CMD_DEV_TABLE_DONE_OUTPUT:
					this.handleDevTableDone('destination')
					break
			}
		}
	}

	// --- Response Handlers ---

	private handleStatusResp(payload: Buffer): void {
		if (payload.length < 4 || !this.pendingRouterInfo) return

		const maxSources = payload.readUInt16BE(0)
		const maxDestinations = payload.readUInt16BE(2)

		clearTimeout(this.pendingRouterInfo.timer)
		this.pendingRouterInfo.resolve({ maxSources, maxDestinations })
		this.pendingRouterInfo = null
	}

	private handleGetMatrixResp(payload: Buffer): void {
		if (payload.length < 4 || !this.pendingMatrixRequest) return

		const startDest = payload.readUInt16BE(0)
		const count = payload.readUInt16BE(2)

		// Each destination has 64 bytes of data (2 bytes per level * 32 levels)
		const dataOffset = 4 // skip startDest(2) + count(2)
		for (let i = 0; i < count; i++) {
			const entryOffset = dataOffset + i * GET_MATRIX_ENTRY_SIZE
			const destId = startDest + i
			const levels: number[] = []

			// Parse all 32 levels (2 bytes each)
			for (let lvl = 0; lvl < 32; lvl++) {
				const lvlOffset = entryOffset + lvl * 2
				if (lvlOffset + 2 <= payload.length) {
					const source = payload.readUInt16BE(lvlOffset)
					// 0x0FFF means "no connection" in Utah Scientific protocol
					levels.push(source === 0x0fff ? -1 : source)
				} else {
					levels.push(-1)
				}
			}

			this.pendingMatrixRequest.results.set(destId, levels)
			this.pendingMatrixRequest.receivedCount++
		}

		// Router sends multiple packets for large requests — resolve when we have all expected results
		if (this.pendingMatrixRequest.receivedCount >= this.pendingMatrixRequest.expectedCount) {
			clearTimeout(this.pendingMatrixRequest.timer)
			this.pendingMatrixRequest.resolve(this.pendingMatrixRequest.results)
			this.pendingMatrixRequest = null
		}
	}

	private handleGetLockResp(payload: Buffer): void {
		if (payload.length < 4 || !this.pendingLockRequest) return

		const count = payload.readUInt16BE(2)
		const results: LockStatus[] = []

		const dataOffset = 4 // skip startDest(2) + count(2)
		for (let i = 0; i < count; i++) {
			const entryOffset = dataOffset + i * GET_LOCK_ENTRY_SIZE
			if (entryOffset + 10 <= payload.length) {
				const lockTypeMask = payload.readUInt32BE(entryOffset)
				const panelId = payload.readUInt16BE(entryOffset + 8)
				results.push({
					isLocked: lockTypeMask !== 0,
					type: lockTypeMask !== 0 ? LockType.Lock : LockType.Unlock,
					panelId,
				})
			}
		}

		clearTimeout(this.pendingLockRequest.timer)
		this.pendingLockRequest.resolve(results)
		this.pendingLockRequest = null
	}

	private handleSystemTake(payload: Buffer): void {
		if (payload.length < 8) return

		const source = payload.readUInt16BE(0)
		const dest = payload.readUInt16BE(2)
		const level = payload.readUInt32BE(4)

		this.emit('status', dest, source === 0x0fff ? -1 : source, level)
	}

	private handleSystemLock(payload: Buffer): void {
		if (payload.length < 7) return

		const panelId = payload.readUInt16BE(2)
		const dest = payload.readUInt16BE(4)
		const statusType = payload[6]

		const isLocked = statusType !== 0x00
		const lockStatus: LockStatus = {
			isLocked,
			type: isLocked ? LockType.Lock : LockType.Unlock,
			panelId,
		}

		this.emit('lock', dest, lockStatus)
	}

	private handleGetListResp(payload: Buffer): void {
		// Parse device entries (48 bytes each)
		let offset = 0
		while (offset + GET_LIST_ENTRY_SIZE <= payload.length) {
			const deviceType = payload.readUInt16BE(offset)
			const deviceIndex = payload.readUInt16BE(offset + 2)

			// Name is 10 bytes of ASCII starting at offset + 4
			let name = ''
			for (let i = 0; i < 10; i++) {
				const ch = payload[offset + 4 + i]
				if (ch === 0) break
				name += String.fromCharCode(ch)
			}
			name = name.trim()

			if (deviceType === 0) {
				this.sourceNameAccumulator.set(deviceIndex, name)
			} else {
				this.destNameAccumulator.set(deviceIndex, name)
			}

			offset += GET_LIST_ENTRY_SIZE
		}
	}

	private handleDevTableDone(type: 'source' | 'destination'): void {
		if (type === 'source' && this.pendingSourceNames) {
			clearTimeout(this.pendingSourceNames.timer)
			this.pendingSourceNames.resolve(this.sourceNameAccumulator)
			this.pendingSourceNames = null
		} else if (type === 'destination' && this.pendingDestNames) {
			clearTimeout(this.pendingDestNames.timer)
			this.pendingDestNames.resolve(this.destNameAccumulator)
			this.pendingDestNames = null
		}
	}

	private handleErrorPacket(interfaceId: number, statusType: number, _payload: Buffer): void {
		const interfaceName = getErrorInterfaceName(interfaceId)
		let message: string

		if (interfaceId === INTF_ERR_UNET) {
			message = `${interfaceName} Error: ${getUnetErrorMessage(statusType)}`
		} else {
			message = `${interfaceName} Error: status type 0x${statusType.toString(16)}`
		}

		this.emit('error', new Error(message))
	}

	private rejectAllPending(reason: string): void {
		const error = new Error(reason)

		if (this.pendingRouterInfo) {
			clearTimeout(this.pendingRouterInfo.timer)
			this.pendingRouterInfo.reject(error)
			this.pendingRouterInfo = null
		}
		if (this.pendingMatrixRequest) {
			clearTimeout(this.pendingMatrixRequest.timer)
			this.pendingMatrixRequest.reject(error)
			this.pendingMatrixRequest = null
		}
		if (this.pendingLockRequest) {
			clearTimeout(this.pendingLockRequest.timer)
			this.pendingLockRequest.reject(error)
			this.pendingLockRequest = null
		}
		if (this.pendingSourceNames) {
			clearTimeout(this.pendingSourceNames.timer)
			this.pendingSourceNames.reject(error)
			this.pendingSourceNames = null
		}
		if (this.pendingDestNames) {
			clearTimeout(this.pendingDestNames.timer)
			this.pendingDestNames.reject(error)
			this.pendingDestNames = null
		}
	}
}
