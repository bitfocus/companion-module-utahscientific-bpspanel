// RCP-3 Protocol Constants and Packet Utilities

// --- Interface IDs ---
export const INTF_SC = 0x12
export const INTF_VERBOSITY = 0x04
export const INTF_PING_SERIAL = 0x02
export const INTF_PING_SOCKET = 0x03
export const INTF_SC4_LIST = 0x80

// Error interface IDs
export const INTF_ERR_PANEL = 0x07
export const INTF_ERR_UNET = 0x0a
export const INTF_ERR_REDUN = 0x0c
export const INTF_ERR_WATCHDOG = 0x0d

const ERROR_INTERFACES = new Set([INTF_ERR_PANEL, INTF_ERR_UNET, INTF_ERR_REDUN, INTF_ERR_WATCHDOG])

// --- Command/Status Codes (Interface 0x12) ---
export const CMD_TAKE = 0x00
export const CMD_STATUS = 0x0e
export const CMD_STATUS_RESP = 0x0f
export const CMD_GET_MATRIX = 0x16
export const CMD_GET_MATRIX_RESP = 0x17
export const CMD_SET_LOCK = 0x2e
export const CMD_GET_LOCK = 0x30
export const CMD_GET_LOCK_RESP = 0x31
export const CMD_CLEAR_LOCK = 0x32

// Unsolicited status codes (Interface 0x12)
export const CMD_SYSTEM_TAKE = 0x5f
export const CMD_SYSTEM_LOCK = 0x62

// --- Ping Codes ---
export const CMD_PING = 0xfe
export const CMD_PING_RESP = 0xfd

// --- Verbosity Codes (Interface 0x04) ---
export const CMD_VERBOSITY = 0x00
export const CMD_VERBOSITY_RESP = 0x01

// --- SC4 List Codes (Interface 0x80) ---
export const CMD_GET_LIST = 0x0d
export const CMD_GET_LIST_RESP = 0x0e
export const CMD_DEV_TABLE_DONE_OUTPUT = 0x26
export const CMD_DEV_TABLE_DONE_INPUT = 0x27

// --- Packet Header Size ---
export const HEADER_SIZE = 6

// Per-destination data sizes in responses
export const GET_MATRIX_ENTRY_SIZE = 64 // 2 bytes per source * 32 levels
export const GET_LOCK_ENTRY_SIZE = 72 // lockType(4) + level(4) + 32 * panel(2)
export const GET_LIST_ENTRY_SIZE = 120

/** All 32 level bits (RCP-3 take / disconnect / lock payloads), independent of module level config. */
export const RCP3_ALL_LEVELS_MASK = 0xffffffff

// --- Lock Types ---
export enum LockType {
	Unlock = 0,
	Lock = 1,
}

export interface LockStatus {
	isLocked: boolean
	type?: LockType
	panelId?: number
}

// --- U-Net Error Messages ---
const UNET_ERRORS: Record<number, string> = {
	0x00: 'Check Sum Error',
	0x01: 'Unrecognized SC Command',
	0x02: 'Unrecognized MX Command',
	0x03: 'Unrecognized Command',
	0x04: 'Unrecognized Group',
	0x05: 'Invalid Mapping Protocol',
	0x06: 'Unrecognized Command Received from Panel',
	0x07: 'Unrecognized Salvo Command Type',
	0x08: 'Requested and Existing U-Net Parameters do not agree',
	0x09: 'Disconnect Protocol is Invalid',
	0x0a: 'Destination / Level already Locked',
	0x0b: 'Unrecognized Broadcast Verbosity Configuration Command',
	0x0c: 'Lock Destination is out of range',
	0x0d: 'Unavailable socket slot',
	0x22: 'Output out of range',
	0x23: 'Source out of range',
}

export function getUnetErrorMessage(code: number): string {
	return UNET_ERRORS[code] ?? `Unknown U-Net error (0x${code.toString(16)})`
}

export function isErrorInterface(interfaceId: number): boolean {
	return ERROR_INTERFACES.has(interfaceId)
}

export function getErrorInterfaceName(interfaceId: number): string {
	switch (interfaceId) {
		case INTF_ERR_PANEL:
			return 'Panel'
		case INTF_ERR_UNET:
			return 'U-Net'
		case INTF_ERR_REDUN:
			return 'Redundancy'
		case INTF_ERR_WATCHDOG:
			return 'Watchdog'
		default:
			return 'Unknown'
	}
}

// --- Packet Building ---

export function calculateChecksum(payload: Buffer): number {
	let sum = 0
	for (let i = 0; i < payload.length; i++) {
		sum = (sum + payload[i]) & 0xff
	}
	return sum
}

export function buildPacket(interfaceId: number, command: number, payload: Buffer = Buffer.alloc(0)): Buffer {
	const header = Buffer.alloc(HEADER_SIZE)
	header[0] = interfaceId
	header[1] = command
	header[2] = calculateChecksum(payload)
	header[3] = 0x00
	header.writeUInt16BE(payload.length, 4)
	return Buffer.concat([header, payload])
}

export interface ParsedPacket {
	interfaceId: number
	command: number
	checksum: number
	payload: Buffer
}

export function parsePacketHeader(
	buffer: Buffer,
	offset: number,
): { interfaceId: number; command: number; checksum: number; payloadLength: number } {
	return {
		interfaceId: buffer[offset],
		command: buffer[offset + 1],
		checksum: buffer[offset + 2],
		payloadLength: buffer.readUInt16BE(offset + 4),
	}
}
