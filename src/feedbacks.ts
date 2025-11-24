import { combineRgb, CompanionFeedbackDefinitions } from '@companion-module/base'
import type { UtahScientificInstance } from './main.js'

export function UpdateFeedbacks(self: UtahScientificInstance): void {
	const feedbacks: CompanionFeedbackDefinitions = {}

	feedbacks['selected_dest'] = {
		type: 'boolean',
		name: 'Selected Destination',
		description: 'Change style of button when destination is selected',
		defaultStyle: {
			color: combineRgb(0, 0, 0),
			bgcolor: combineRgb(102, 255, 102),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Destination',
				id: 'dest',
				default: self.router.state.destinationNames[0]?.id,
				choices: self.router.state.destinationNames,
			},
		],
		callback: (feedback) => {
			const destId =
				typeof feedback.options.dest === 'string' ? parseInt(feedback.options.dest, 10) : Number(feedback.options.dest)
			return self.router.state.selectedDestination === destId
		},
	}

	feedbacks['selected_source'] = {
		type: 'boolean',
		name: 'Selected Source',
		description: 'Change style of button when source is selected',
		defaultStyle: {
			color: combineRgb(0, 0, 0),
			bgcolor: combineRgb(102, 255, 255),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.router.state.sourceNames[0]?.id,
				choices: self.router.state.sourceNames,
			},
		],
		callback: (feedback) => {
			const sourceId =
				typeof feedback.options.source === 'string'
					? parseInt(feedback.options.source, 10)
					: Number(feedback.options.source)
			return self.router.state.selectedSource === sourceId
		},
	}

	feedbacks['source_dest_route'] = {
		type: 'boolean',
		name: 'Source Routed to Destination',
		description: 'Change style of button when source is routed to selected destination on any level',
		defaultStyle: {
			color: combineRgb(0, 0, 0),
			bgcolor: combineRgb(255, 191, 128),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.router.state.sourceNames[0]?.id,
				choices: self.router.state.sourceNames,
			},
		],
		callback: (feedback) => {
			const statuses = self.router.state.routes
			const selectedDestination = self.router.state.selectedDestination
			if (selectedDestination < 1 || selectedDestination > statuses.length) {
				return false
			}
			const sourceId =
				typeof feedback.options.source === 'string'
					? parseInt(feedback.options.source, 10)
					: Number(feedback.options.source)
			return statuses[selectedDestination - 1] === sourceId
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}
