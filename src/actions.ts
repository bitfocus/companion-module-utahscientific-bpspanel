import type { UtahScientificInstance } from './main.js'

export function UpdateActions(self: UtahScientificInstance): void {
	self.setActionDefinitions({
		select_source_name: {
			name: 'Select Source',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.router.state.sourceNames[0]?.id,
					choices: self.router.state.sourceNames,
				},
				{
					type: 'checkbox',
					label: 'Take On Select',
					id: 'take',
					default: false,
					description: 'Take the source immediately after selecting it, bypassing the separate Take action',
				},
			],

			callback: (action) => {
				const sourceId =
					typeof action.options.source === 'string'
						? parseInt(action.options.source, 10)
						: Number(action.options.source)
				if (!isNaN(sourceId)) {
					self.router.selectSource(sourceId)
					if (action.options.take) {
						if (self.router.state.selectedDestination >= 0) {
							self.router.take(sourceId, self.router.state.selectedDestination, 1)
						} else {
							self.log('warn', 'Destination not selected')
						}
					}
				}
			},
		},
		select_dest_name: {
			name: 'Select Destination',
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
			name: 'Route Source to Destination',
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
		set_lock: {
			name: 'Set Lock',
			options: [
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'destination',
					default: self.router.state.destinationNames[0]?.id,
					choices: self.router.state.destinationNames,
				},
				{
					type: 'dropdown',
					label: 'Lock Status',
					id: 'lock',
					default: 'unlock',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'unlock', label: 'Unlock' },
						{ id: 'lock', label: 'Lock' },
					],
				},
			],
			callback: (action) => {
				const destId =
					typeof action.options.destination === 'string'
						? parseInt(action.options.destination, 10)
						: Number(action.options.destination)
				const lock = action.options.lock
				if (!isNaN(destId)) {
					if (lock === 'toggle') {
						console.log(destId)
						const lockState = self.router.state.locks[destId - 1]
						console.log(lockState)
						if (lockState === undefined) return
						self.router.setLock(destId, !lockState)
					} else {
						self.router.setLock(destId, lock === 'lock')
					}
				}
			},
		},
	})
}
