import type { UtahScientificInstance } from './main.js'
import { parseOptionId } from './utils.js'

export function UpdateActions(self: UtahScientificInstance): void {
	const levelChoices = self.api.state.levels

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
				self.api.selectLevels(levels)
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
				self.api.deselectLevels(levels)
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
				self.api.toggleLevels(levels)
			},
		},
		select_source_name: {
			name: 'Select Source',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.api.state.sourceNames[0]?.id,
					choices: self.api.state.sourceNames,
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
				const sourceId = parseOptionId(action.options.source)
				if (!isNaN(sourceId)) {
					self.api.selectSource(sourceId)
					if (action.options.take) {
						if (self.api.state.selectedDestination >= 0) {
							const levelMask = self.api.buildLevelMask()
							if (levelMask === 0) {
								self.log('warn', 'No levels selected for take; enable at least one level')
								return
							}
							await self.api.take(sourceId, self.api.state.selectedDestination, levelMask)
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
					default: self.api.state.destinationNames[0]?.id,
					choices: self.api.state.destinationNames,
				},
			],
			callback: async (action) => {
				const destId = parseOptionId(action.options.dest)
				if (!isNaN(destId)) {
					self.api.selectDestination(destId)
				}
			},
		},
		take: {
			name: 'Take',
			options: [],
			callback: async () => {
				const source = self.api.state.selectedSource
				const destination = self.api.state.selectedDestination
				if (source >= 0 && destination >= 0) {
					const levelMask = self.api.buildLevelMask()
					if (levelMask === 0) {
						self.log('warn', 'No levels selected for take; enable at least one level')
						return
					}
					return await self.api.take(source, destination, levelMask)
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
					default: self.api.state.sourceNames[0]?.id,
					choices: self.api.state.sourceNames,
				},
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'destination',
					default: self.api.state.destinationNames[0]?.id,
					choices: self.api.state.destinationNames,
				},
				{
					type: 'dropdown',
					label: 'Routing Mode',
					id: 'mode',
					default: 'all',
					choices: [
						{ id: 'all', label: 'All Levels' },
						{ id: 'selected', label: 'Selected Levels' },
					],
				},
				{
					type: 'multidropdown',
					label: 'Levels',
					id: 'levels',
					default: levelChoices.map((l) => l.id),
					choices: levelChoices,
					isVisibleExpression: `$(options:mode) === 'selected'`,
				},
			],
			callback: async (action) => {
				const sourceId = parseOptionId(action.options.source)
				const destId = parseOptionId(action.options.destination)
				const mode = action.options.mode === 'selected' ? 'selected' : 'all'
				const mask = self.api.buildLevelMaskForRoute(mode, (action.options.levels as number[]) ?? [])
				if (mask === 0) {
					self.log('warn', 'No levels in route; pick "All levels" or select at least one level')
					return
				}
				if (!isNaN(sourceId) && !isNaN(destId)) {
					return await self.api.take(sourceId, destId, mask)
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
					default: self.api.state.destinationNames[0]?.id,
					choices: self.api.state.destinationNames,
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
				const destId = parseOptionId(action.options.destination)
				const lock = action.options.lock
				if (!isNaN(destId)) {
					if (lock === 'toggle') {
						const lockState = self.api.state.locks[destId]
						if (lockState === undefined) return
						return await self.api.setLock(destId, !lockState)
					} else {
						return await self.api.setLock(destId, lock === 'lock')
					}
				}
			},
		},
	})
}
