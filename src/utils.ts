export function parseOptionId(value: unknown): number {
	return typeof value === 'string' ? parseInt(value, 10) : Number(value)
}
