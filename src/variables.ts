import type { UtahScientificInstance } from './main.js'
import type { CompanionVariableDefinition } from '@companion-module/base'

export function UpdateVariableDefinitions(self: UtahScientificInstance): void {
	const variables: CompanionVariableDefinition[] = []
	const numLevels = self.api.state.numLevels

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

	const destinations = self.api.state.destinationNames

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
			variables.push({
				variableId: `route_${id}_${lvl}`,
				name: `Destination ${id} - Level ${lvl} - Active Source ID`,
			})
		}
	}

	// Source name variables (for sources not covered by destinations loop)
	for (const source of self.api.state.sourceNames) {
		const exists = destinations.some((d) => d.id === source.id)
		if (!exists) {
			variables.push({ variableId: `source_${source.id}_name`, name: `Source ${source.id} - Label` })
		}
	}

	self.setVariableDefinitions(variables)
}

export function UpdateVariables(self: UtahScientificInstance): void {
	const routes = self.api.state.routes
	const numLevels = self.api.state.numLevels
	const sourceNames = self.api.state.sourceNames
	const destinationNames = self.api.state.destinationNames
	const selectedSource = self.api.state.selectedSource
	const selectedDestination = self.api.state.selectedDestination

	const values: Record<string, string | number> = {
		sources: sourceNames.length,
		destinations: destinationNames.length,
		destination: selectedDestination === -1 ? 'None' : selectedDestination,
		source: selectedSource === -1 ? 'None' : selectedSource,
		// Legacy Module (v2.0.0) variables
		Sources: sourceNames.length,
		Destinations: destinationNames.length,
		Destination: selectedDestination === -1 ? 'None' : selectedDestination,
		Source: selectedSource === -1 ? 'None' : selectedSource,
	}

	for (const source of sourceNames) {
		values[`source_${source.id}_name`] = source.label
		// Legacy Module (v2.0.0) variables
		values[`Source_${source.id}`] = source.label
	}

	for (const dest of destinationNames) {
		const id = dest.id
		const destLevels = routes.get(id)

		values[`destination_${id}_name`] = dest.label

		const lockState = self.api.state.locks[id]
		values[`destination_${id}_lock_state`] = lockState ? 'Locked' : 'Unlocked'

		// Level 1 legacy variables
		const level1Source = destLevels?.[0] ?? -1
		const level1SourceName =
			level1Source < 0 ? 'None' : (sourceNames.find((s) => s.id === level1Source)?.label ?? 'Unknown')
		values[`destination_${id}_source_id`] = level1Source < 0 ? 'None' : level1Source
		values[`destination_${id}_source_name`] = level1SourceName
		// Legacy Module (v2.0.0) variables
		values[`Destination_${id}`] = dest.label
		// Per-level variables
		for (let lvl = 1; lvl <= numLevels; lvl++) {
			const sourceId = destLevels?.[lvl - 1] ?? -1
			values[`route_${id}_${lvl}`] = sourceId < 0 ? 'None' : sourceId
		}
	}

	self.setVariableValues(values)
}
