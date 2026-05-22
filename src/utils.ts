export function parseOptionId(value: unknown): number {
	return typeof value === 'string' ? parseInt(value, 10) : Number(value)
}

export function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}
