import type { UtahScientificInstance } from './main.js'
import type { CompanionVariableDefinition } from '@companion-module/base'

export function UpdateVariableDefinitions(self: UtahScientificInstance): void {
	const variables: CompanionVariableDefinition[] = []
	const numLevels = self.router.state.numLevels

	variables.push(
		{
			name: 'Number of sources returned by router',
			variableId: 'sources',
		},
		{
			name: 'Number of destinations returned by router',
			variableId: 'destinations',
		},
		{
			name: 'Selected destination',
			variableId: 'destination',
		},
		{
			name: 'Selected source',
			variableId: 'source',
		},
	)

	const destinations = self.router.state.destinationNames

	for (const dest of destinations) {
		const id = dest.id
		variables.push(
			{ variableId: `source_${id}_name`, name: `Source ${id} - Label` },
			{ variableId: `destination_${id}_name`, name: `Destination ${id} - Label` },
			{ variableId: `destination_${id}_source_name`, name: `Destination ${id} - Current Source Name (Level 1)` },
			{ variableId: `destination_${id}_source_id`, name: `Destination ${id} - Current Source ID (Level 1)` },
			{ variableId: `destination_${id}_lock_state`, name: `Destination ${id} - Lock State` },
		)

		// Per-level variables
		for (let lvl = 1; lvl <= numLevels; lvl++) {
			variables.push(
				{
					variableId: `destination_${id}_level_${lvl}_source_id`,
					name: `Destination ${id} - Level ${lvl} - Source ID`,
				},
				/* {
					variableId: `destination_${id}_level_${lvl}_source_name`,
					name: `Destination ${id} Level ${lvl} - Source Name`,
				}, */
			)
		}
	}

	// Source name variables (for sources not covered by destinations loop)
	for (const source of self.router.state.sourceNames) {
		const exists = destinations.some((d) => d.id === source.id)
		if (!exists) {
			variables.push({ variableId: `source_${source.id}_name`, name: `Source ${source.id} - Label` })
		}
	}

	self.setVariableDefinitions(variables)
}

export function UpdateVariables(self: UtahScientificInstance): void {
	const routes = self.router.state.routes
	const numLevels = self.router.state.numLevels

	for (const dest of self.router.state.destinationNames) {
		const id = dest.id
		const destLevels = routes.get(id)

		// Level 1 legacy variables
		const level1Source = destLevels?.[0] ?? 0
		const level1SourceName = self.router.state.sourceNames.find((s) => s.id === level1Source)?.label ?? 'Unknown'
		self.setVariableValues({
			[`destination_${id}_source_id`]: level1Source,
			[`destination_${id}_source_name`]: level1SourceName,
		})

		// Per-level variables
		for (let lvl = 1; lvl <= numLevels; lvl++) {
			const sourceId = destLevels?.[lvl - 1] ?? 0
			//const sourceName = self.router.state.sourceNames.find((s) => s.id === sourceId)?.label ?? 'Unknown'
			self.setVariableValues({
				[`destination_${id}_level_${lvl}_source_id`]: sourceId,
				//[`destination_${id}_level_${lvl}_source_name`]: sourceName,
			})
		}
	}

	const sourceNames = self.router.state.sourceNames
	for (const source of sourceNames) {
		self.setVariableValues({ [`source_${source.id}_name`]: source.label })
	}
	const destinationNames = self.router.state.destinationNames
	for (const destination of destinationNames) {
		self.setVariableValues({ [`destination_${destination.id}_name`]: destination.label })
		const lockState = self.router.state.locks[destination.id - 1]
		self.setVariableValues({ [`destination_${destination.id}_lock_state`]: lockState ? 'Locked' : 'Unlocked' })
	}

	const selectedSource = self.router.state.selectedSource
	const selectedDestination = self.router.state.selectedDestination
	self.setVariableValues({
		sources: sourceNames.length,
		destinations: destinationNames.length,
		destination: selectedDestination === -1 ? 'None' : selectedDestination,
		source: selectedSource === -1 ? 'None' : selectedSource,
	})
}
