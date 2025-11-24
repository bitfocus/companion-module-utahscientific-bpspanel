import type { UtahScientificInstance } from './main.js'

export function UpdateActions(self: UtahScientificInstance): void {
	self.setActionDefinitions({
		select_source_name: {
			name: 'Select Source name',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.router.state.sourceNames[0]?.id,
					choices: self.router.state.sourceNames,
				},
			],

			callback: (action) => {
				const sourceId =
					typeof action.options.source === 'string'
						? parseInt(action.options.source, 10)
						: Number(action.options.source)
				if (!isNaN(sourceId)) {
					self.router.selectSource(sourceId)
				}
			},
		},
		select_dest_name: {
			name: 'Select Destination name',
			options: [
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'dest',
					default: self.router.state.destinationNames[0]?.id,
					choices: self.router.state.destinationNames,
				},
			],
			callback: (action) => {
				const destId =
					typeof action.options.dest === 'string' ? parseInt(action.options.dest, 10) : Number(action.options.dest)
				if (!isNaN(destId)) {
					self.router.selectDestination(destId)
				}
			},
		},
		take: {
			name: 'Take',
			options: [],
			callback: () => {
				const source = self.router.state.selectedSource
				const destination = self.router.state.selectedDestination
				if (source >= 0 && destination >= 0) {
					self.router.take(source, destination, 1)
				} else {
					self.log('error', 'Source or destination not selected')
				}
			},
		},
		route: {
			name: 'Single Press Take Src to Dst',
			options: [
				{
					type: 'dropdown',
					label: 'Source  ',
					id: 'source',
					default: self.router.state.sourceNames[0]?.id,
					choices: self.router.state.sourceNames,
				},
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'destination',
					default: self.router.state.destinationNames[0]?.id,
					choices: self.router.state.destinationNames,
				},
			],
			callback: (action) => {
				const sourceId =
					typeof action.options.source === 'string'
						? parseInt(action.options.source, 10)
						: Number(action.options.source)
				const destId =
					typeof action.options.destination === 'string'
						? parseInt(action.options.destination, 10)
						: Number(action.options.destination)
				if (!isNaN(sourceId) && !isNaN(destId)) {
					self.router.take(sourceId, destId, 1)
				}
			},
		},
	})
}
