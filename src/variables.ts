import type { UtahScientificInstance } from './main.js'
import type { CompanionVariableDefinition } from '@companion-module/base'
export function UpdateVariableDefinitions(self: UtahScientificInstance): void {
	const variables: CompanionVariableDefinition[] = []

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

	const statuses = self.router.state.routes
	for (let i = 0; i < statuses.length; i++) {
		const id = i + 1
		variables.push(
			{ variableId: `source_${id}_name`, name: `Source ${id} - Label` },
			{ variableId: `destination_${id}_name`, name: `Destination ${id} - Label` },
			{ variableId: `destination_${id}_source_name`, name: `Destination ${id} - Current Source Name` },
			{ variableId: `destination_${id}_source_id`, name: `Destination ${id} - Current Source ID` },
		)
	}

	self.setVariableDefinitions(variables)
}

export function UpdateVariables(self: UtahScientificInstance): void {
	const statuses = self.router.state.routes
	for (let i = 0; i < statuses.length; i++) {
		const id = i + 1
		const sourceId = statuses[i]
		const sourceName = self.router.state.sourceNames.find((source) => source.id === sourceId)?.label
		self.setVariableValues({ [`destination_${id}_source_id`]: sourceId, [`destination_${id}_source_name`]: sourceName })
	}
	const sourceNames = self.router.state.sourceNames
	for (const source of sourceNames) {
		self.setVariableValues({ [`source_${source.id}_name`]: source.label })
	}
	const destinationNames = self.router.state.destinationNames
	for (const destination of destinationNames) {
		self.setVariableValues({ [`destination_${destination.id}_name`]: destination.label })
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
