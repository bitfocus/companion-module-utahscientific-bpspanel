import type { UtahScientificInstance } from './main.js'

export function UpdateActions(self: UtahScientificInstance): void {
	const levelChoices = self.router.state.levels

	self.setActionDefinitions({
		select_level: {
			name: 'Select Levels',
			options: [
				{
					type: 'multidropdown',
					label: 'Levels',
					id: 'level',
					default: levelChoices.map((l) => l.id),
					choices: levelChoices,
				},
			],
			callback: (action) => {
				const levels = action.options.level as number[]
				self.router.selectLevels(levels)
			},
		},
		deselect_level: {
			name: 'Deselect Levels',
			options: [
				{
					type: 'multidropdown',
					label: 'Levels',
					id: 'level',
					default: [],
					choices: levelChoices,
				},
			],
			callback: (action) => {
				const levels = action.options.level as number[]
				self.router.deselectLevels(levels)
			},
		},
		toggle_level: {
			name: 'Toggle Levels',
			options: [
				{
					type: 'multidropdown',
					label: 'Levels',
					id: 'level',
					default: [],
					choices: levelChoices,
				},
			],
			callback: (action) => {
				const levels = action.options.level as number[]
				self.router.toggleLevels(levels)
			},
		},
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

			callback: async (action) => {
				const sourceId =
					typeof action.options.source === 'string'
						? parseInt(action.options.source, 10)
						: Number(action.options.source)
				if (!isNaN(sourceId)) {
					self.router.selectSource(sourceId)
					if (action.options.take) {
						if (self.router.state.selectedDestination >= 0) {
							const levelMask = self.router.buildLevelMask()
							await self.router.take(sourceId, self.router.state.selectedDestination, levelMask)
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
			callback: async (action) => {
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
			callback: async () => {
				const source = self.router.state.selectedSource
				const destination = self.router.state.selectedDestination
				if (source >= 0 && destination >= 0) {
					const levelMask = self.router.buildLevelMask()
					return await self.router.take(source, destination, levelMask)
				} else {
					self.log('warn', 'Source or destination not selected')
				}
			},
		},
		route: {
			name: 'Route Source to Destination',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
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
				{
					type: 'multidropdown',
					label: 'Levels',
					id: 'level',
					default: levelChoices.map((l) => l.id),
					choices: levelChoices,
				},
			],
			callback: async (action) => {
				const sourceId =
					typeof action.options.source === 'string'
						? parseInt(action.options.source, 10)
						: Number(action.options.source)
				const destId =
					typeof action.options.destination === 'string'
						? parseInt(action.options.destination, 10)
						: Number(action.options.destination)
				const selectedLevelIds = action.options.level as number[]
				if (!isNaN(sourceId) && !isNaN(destId)) {
					let mask = 0
					for (const id of selectedLevelIds) {
						mask |= 1 << (id - 1)
					}
					return await self.router.take(sourceId, destId, mask)
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
			callback: async (action) => {
				const destId =
					typeof action.options.destination === 'string'
						? parseInt(action.options.destination, 10)
						: Number(action.options.destination)
				const lock = action.options.lock
				if (!isNaN(destId)) {
					if (lock === 'toggle') {
						const lockState = self.router.state.locks[destId - 1]
						if (lockState === undefined) return
						return await self.router.setLock(destId, !lockState)
					} else {
						return await self.router.setLock(destId, lock === 'lock')
					}
				}
			},
		},
	})
}
