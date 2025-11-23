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

	const statuses = self.router.currentRoutes()
	for (let i = 0; i < statuses.length; i++) {
		const id = i + 1
		variables.push(
			{ variableId: `input_${id}_name`, name: `Input ${id} - Label` },
			{ variableId: `output_${id}_name`, name: `Output ${id} - Label` },
			{ variableId: `output_${id}_input`, name: `Output ${id} - Current Input` },
		)
	}

	self.setVariableDefinitions(variables)
}

export function UpdateVariables(self: UtahScientificInstance): void {
	const statuses = self.router.currentRoutes()
	for (let i = 0; i < statuses.length; i++) {
		const id = i + 1
		const input = statuses[i] as number
		self.setVariableValues({ [`output_${id}_input`]: input })
	}
	const sourceNames = self.router.getSourceNames()
	for (const source of sourceNames) {
		self.setVariableValues({ [`input_${source.id}_name`]: source.label })
	}
	const destinationNames = self.router.getDestinationNames()
	for (const destination of destinationNames) {
		self.setVariableValues({ [`output_${destination.id}_name`]: destination.label })
	}

	const selectedSource = self.router.getSelectedSource()
	const selectedDestination = self.router.getSelectedDestination()
	self.setVariableValues({
		sources: sourceNames.length,
		destinations: destinationNames.length,
		destination: selectedDestination === -1 ? 'None' : selectedDestination,
		source: selectedSource === -1 ? 'None' : selectedSource,
	})
}
