import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	host: string
	port: number
	levels: number
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module will allow you to control Utah Scientific Routers via an SC4, SC400, UDS, etc.',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Router Controller IP',
			width: 6,
			regex: Regex.IP,
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Port',
			width: 6,
			default: '5001',
			regex: Regex.PORT,
		},
		{
			type: 'number',
			id: 'levels',
			label: 'Number of Levels',
			width: 6,
			default: 1,
			min: 1,
			max: 32,
			step: 1,
		},
	]
}
