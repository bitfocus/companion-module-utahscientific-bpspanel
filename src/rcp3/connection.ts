import { EventEmitter } from 'events'
import * as net from 'net'
import {
	HEADER_SIZE,
	buildPacket,
	calculateChecksum,
	parsePacketHeader,
	INTF_PING_SOCKET,
	CMD_PING,
	CMD_PING_RESP,
	INTF_VERBOSITY,
	CMD_VERBOSITY,
	type ParsedPacket,
} from './protocol.js'

export interface RCP3ConnectionOptions {
	host: string
	port: number
	debug?: boolean
}

export class RCP3Connection extends EventEmitter {
	private socket: net.Socket | null = null
	private buffer = Buffer.alloc(0)
	private debug: boolean

	constructor(debug = false) {
		super()
		this.debug = debug
	}

	async connect(options: RCP3ConnectionOptions): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.socket) {
				this.socket.removeAllListeners()
				this.socket.destroy()
			}

			this.buffer = Buffer.alloc(0)
			const socket = new net.Socket()
			this.socket = socket

			const connectTimeout = setTimeout(() => {
				socket.destroy()
				reject(new Error('Connection timeout'))
			}, 10000)

			socket.once('connect', () => {
				clearTimeout(connectTimeout)
				this.log('Connected to router')

				// Enable unsolicited status by sending verbosity command
				this.sendVerbosity(0x02)

				this.emit('connected')
				resolve()
			})

			socket.on('data', (data: Buffer) => {
				this.handleData(data)
			})

			socket.on('error', (err: Error) => {
				clearTimeout(connectTimeout)
				this.emit('error', err)
			})

			socket.on('close', () => {
				clearTimeout(connectTimeout)
				this.emit('disconnected')
			})

			socket.connect(options.port, options.host)
		})
	}

	async disconnect(): Promise<void> {
		if (this.socket) {
			this.socket.removeAllListeners()
			this.socket.destroy()
			this.socket = null
		}
		this.buffer = Buffer.alloc(0)
	}

	sendPacket(interfaceId: number, command: number, payload: Buffer = Buffer.alloc(0)): void {
		if (!this.socket || this.socket.destroyed) {
			throw new Error('Not connected')
		}
		const packet = buildPacket(interfaceId, command, payload)
		this.log(`TX: intf=0x${interfaceId.toString(16)} cmd=0x${command.toString(16)} len=${payload.length}`)
		this.socket.write(packet)
	}

	private sendVerbosity(level: number): void {
		const payload = Buffer.alloc(2)
		payload.writeUInt16BE(level, 0)
		this.sendPacket(INTF_VERBOSITY, CMD_VERBOSITY, payload)
	}

	private handleData(data: Buffer): void {
		this.buffer = Buffer.concat([this.buffer, data])

		while (this.buffer.length >= HEADER_SIZE) {
			const { interfaceId, command, checksum, payloadLength } = parsePacketHeader(this.buffer, 0)
			const totalSize = HEADER_SIZE + payloadLength

			if (this.buffer.length < totalSize) {
				break // Wait for more data
			}

			const payload = this.buffer.subarray(HEADER_SIZE, totalSize)

			const calculatedChecksum = calculateChecksum(payload)
			if (calculatedChecksum !== checksum) {
				this.log(`Checksum mismatch: expected 0x${checksum.toString(16)}, got 0x${calculatedChecksum.toString(16)}`)
				// Length field may be wrong if we were out of sync; discard queued data and surface error.
				this.buffer = Buffer.alloc(0)
				this.emit('error', new Error('RCP-3 checksum mismatch'))
				break
			}

			this.buffer = this.buffer.subarray(totalSize)

			// Auto-respond to ping requests
			if (command === CMD_PING) {
				this.log('Received ping, sending pong')
				try {
					this.sendPacket(
						interfaceId === INTF_PING_SOCKET ? INTF_PING_SOCKET : interfaceId,
						CMD_PING_RESP,
						Buffer.alloc(0),
					)
				} catch {
					// Socket closed before we could respond — ignore
				}
				continue
			}

			const parsed: ParsedPacket = { interfaceId, command, checksum, payload }
			this.log(`RX: intf=0x${interfaceId.toString(16)} cmd=0x${command.toString(16)} len=${payloadLength}`)
			this.emit('packet', parsed)
		}
	}

	get isConnected(): boolean {
		return this.socket !== null && !this.socket.destroyed
	}

	private log(message: string): void {
		if (this.debug) {
			console.log(`[RCP3] ${message}`)
		}
	}
}
