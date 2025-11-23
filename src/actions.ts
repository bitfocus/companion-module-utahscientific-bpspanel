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
					default: self.router.sourceNames[0]?.id,
					choices: self.router.sourceNames,
				},
			],

			callback: (action) => {
				self.router.selectSource(parseInt(action.options.source as string))
			},
		},
		select_dest_name: {
			name: 'Select Destination name',
			options: [
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'dest',
					default: self.router.destinationNames[0]?.id,
					choices: self.router.destinationNames,
				},
			],
			callback: (action) => {
				self.router.selectDestination(parseInt(action.options.dest as string))
			},
		},
		take: {
			name: 'Take',
			options: [],
			callback: () => {
				const source = self.router.getSelectedSource()
				const destination = self.router.getSelectedDestination()
				if (source && destination) {
					self.router.take(self.router.getSelectedSource(), self.router.getSelectedDestination(), 1)
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
					default: self.router.sourceNames[0]?.id,
					choices: self.router.sourceNames,
				},
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'destination',
					default: self.router.destinationNames[0]?.id,
					choices: self.router.destinationNames,
				},
			],
			callback: (action) => {
				self.router.take(parseInt(action.options.source as string), parseInt(action.options.destination as string), 1)
			},
		},
	})
}
